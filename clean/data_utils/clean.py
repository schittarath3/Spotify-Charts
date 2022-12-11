import spotipy
import json
import glob
import pandas as pd

from string import punctuation
from spotipy.oauth2 import SpotifyClientCredentials
from datetime import datetime
from dateutil.relativedelta import relativedelta

# Need to set Spotipy client id and client secret
auth_manager = SpotifyClientCredentials()
sp = spotipy.Spotify(auth_manager=auth_manager)


def load_file(file: str) -> list:
    "Loads streaming history file"
    with open(file) as f:
        tracks = json.load(f)
        return tracks


def cat_files() -> list:
    "Loads streaming history files and concatenates into one list"
    data = glob.glob("data/history/*")
    data.sort()
    songs = []
    for f in data:
        s = load_file(f)
        songs += load_file(f)
    return songs


def get_track_uri(artistName: str, trackName: str) -> str:
    "Attempts to a track's URI from spotify using the artist name and track name"
    _type = "track"
    limit = 1
    q = f"artist:{artistName} track:{trackName}"
    res = sp.search(q=q, type=_type, limit=limit)["tracks"]["items"]
    if len(res) > 0:
        return res[0]["uri"]
    else:
        print(artistName, " ", trackName)


def get_unique_songs(songs: list) -> set:
    "Returns unique songs from list"
    unq_songs = set(
        [(s["artistName"], s["trackName"]) for s in songs]
        )
    return unq_songs


def get_uri_mapping(songs: set) -> dict:
    "Maps (artistNames, tracKName) to its URI"
    songs = list(songs)
    uri_map = {}
    for i, s in enumerate(songs):
        artist, track = s
        artistClean = artist.translate(str.maketrans('', '', punctuation))
        trackClean = track.translate(str.maketrans('', '', punctuation))
        uri_map[(artist, track)] = get_track_uri(artistClean, trackClean)
    uri_map = {v:k for k,v in uri_map.items() if v is not None}
    return {v:k for k,v in uri_map.items() if v is not None}


def get_features(uris: list) -> dict:
    "Gets a track's audio feature from spotify"
    L = len(uris)
    feature_mapping = {}
    for i in range(0, L, 100):
        curUris = uris[i:i+100]
        features = sp.audio_features(curUris)
        curMap = dict(zip(curUris, features))
        feature_mapping = {**feature_mapping, **curMap}
    return feature_mapping

def mappings_to_csv(uri_map: dict, features_map: dict, stream_times: dict) -> pd.DataFrame:
    "Saves track audio features to a csv"
    bad_keys = ["id", "uri", "track_href", "analysis_url", "type"]
    features_keys = list(features_map.values())[0].keys()
    features_keys = [k for k in features_keys if k not in bad_keys]
    features_dict = {k:[track[k] for track in features_map.values() if track is not None] for k in features_keys}

    no_features = [k for k,v in features_map.items() if v is None]
    uri_map = {k:v for k,v in uri_map.items() if v not in no_features}
    stream_times = {k:v for k,v in stream_times.items() if k not in no_features}

    artists = [s[0] for s in uri_map.keys()]
    tracks = [s[1] for s in uri_map.keys()]
    uris = list(uri_map.values())
    st = list(stream_times.values())

    track_dict = {
        "artist": artists,
        "track": tracks,
        "uri": uris,
        "sum_stream_time": st,
    }

    track_dict = {**track_dict, **features_dict}
    track_df = pd.DataFrame.from_dict(track_dict)
    track_df.to_csv("data/dataframes/track_features.csv", index=False)

    return track_df

def total_listen_time(stream_data: list, uri_map: dict) -> dict:
    "Saves total listen time to a csv"
    stream_time = {}
    for s in stream_data:
        uri = uri_map.get((s["artistName"], s["trackName"]), None)
        stream_time[uri] = stream_time.get(uri, 0) + s["msPlayed"]
    del stream_time[None]

    # Sorts based on uri map ordering
    str_time_copy = {}
    for v in uri_map.values():
        str_time_copy[v] = stream_time[v]
    return str_time_copy


def stream_time_to_csv(stream_times: list, uri_map: dict) -> pd.DataFrame:
    "Saves cleaned streaming history to a csv"
    artists = []
    tracks = []
    uris = []
    time = []
    ms_played = []
    for s in stream_times:
        uri = uri_map.get((s["artistName"], s["trackName"]), None)
        if uri is not None:
            artists.append(s["artistName"])
            tracks.append(s["trackName"])
            uris.append(uri)
            time.append(s["endTime"])
            ms_played.append(s["msPlayed"])
    stream_time_dict = {
        "artist": artists,
        "track": tracks,
        "uri": uris,
        "time": time,
        "ms_played": ms_played,
    }
    st_df = pd.DataFrame.from_dict(stream_time_dict)
    st_df.to_csv("data/dataframes/stream_history.csv")
    return st_df


def combine_feature_stream(feature_df: pd.DataFrame, stream_df: pd.DataFrame) -> pd.DataFrame:
    "Combines track features and streaming history into a flat csv"
    combined_df = stream_df.join(feature_df.set_index('uri'), on='uri', rsuffix="_feature")
    combined_df.drop(["artist_feature", "track_feature"], axis="columns", inplace=True)
    combined_df["time"] = pd.to_datetime(combined_df["time"])

    combined_df.to_csv("data/dataframes/combined_data.csv")
    
    return combined_df


def monthy_artist_metrics(combined_df: pd.DataFrame) -> pd.DataFrame:
    "Creates a csv with how much each artist is played per month"
    # Remove artist that have been listened to once or twice
    discovery = [combined_df.artist.value_counts() < 100][0]
    not_discovery_artist = [artist for artist, value in zip(discovery.index, discovery.values) if bool(value) is False]
    combined_df = combined_df[combined_df.artist.isin(not_discovery_artist)]
    
    monthly_df = pd.DataFrame(columns=["month", "artist", "ms_played",])
    for i in range(13):
        curMonth = datetime(2021,11,1) + relativedelta(months=i)
        month_df = combined_df[(combined_df['time'] < curMonth + relativedelta(day=31))]
        data = month_df.groupby(["artist"]).ms_played.sum().reset_index()
        
        data["month"] = [curMonth] * len(data.index)

        monthly_df = monthly_df.append(data, ignore_index=True)

    monthly_df.to_csv("data/dataframes/monthly_data.csv")

    return monthly_df

def artist_detail_metrics(combined_df: pd.DataFrame, k: int = 5) -> pd.DataFrame:
    "Averages track features based on artist"
    FEATURE_COLS = ["danceability", "energy", "loudness", "speechiness", \
        "acousticness", "instrumentalness", "liveness", "valence", "tempo"]
    agg_data = combined_df.groupby(["artist"], as_index=False)[FEATURE_COLS].mean()
    
    artist_top_tracks = {
        i:[] for i in range(k)
    }
    for artist in agg_data.artist:
        artist_v = combined_df.loc[combined_df.artist == artist].groupby("track").ms_played.sum().sort_values(ascending=False)
        top_k = artist_v[0:k]
        num_top = len(top_k)
        for i in range(k):
            if i < num_top:
                track = top_k.index[i]
                artist_top_tracks[i].append(track)
            else:
                artist_top_tracks[i].append("")

    top_track_df = pd.DataFrame.from_dict(artist_top_tracks)
    combined_df = pd.concat([agg_data, top_track_df], axis="columns")

    combined_df.to_csv("data/dataframes/artist_track_features.csv")
    
    return combined_df
    