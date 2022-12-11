# Spotify-Charts
Visualize your streaming data from the past year!

## Usage
*If you do not want to use your own data, my own streaming history is already provided, so you can skip to the next section*

### Downloading and cleaning your data
Dependencies
`Python: 
    Python >= 3.8
    pandas
    spotipy
`  

Download your Spotify streaming data by signing into your account at [Spotify][https://accounts.spotify.com/] and going to Privacy Settings>Download your data>Account data. You can download your extended streaming data too, but it takes longer to retrieve.

Setup your Spotify Developer account, navigate to the dashboard, and create an app. From here, retrieve your **Client ID** and **Client Secret**. In the .env file, copy these keys over to the respective environment variables. 

Once you downloaded your streaming data, unzip the file, and drop the .csv files into clean/data/history.

Run through the cells in `clean/clean_data.ipynb`.

Your data should now be cleaned.

### Running the visualization
Open your terminal or command prompt and run 
`python -m http.server 8080`
Open your favorite browser and type
`http://localhost:8080/` to see the visualization
