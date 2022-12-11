// Main SVG element
var svg = d3.select('svg');

// Artist features
var ftGroup = svg.append("g")
    .attr("class", "feature")
    .attr('transform', 'translate(1225,200)')
var ftArtist = ftGroup.append("text")
    .text("Artist: ")
var ftTotalTime = ftGroup.append("text")
    .text("Minutes streamed: ")
    .attr('transform', 'translate(0,25)')
var ftDance = ftGroup.append("text")
    .text("Danceability: ")
    .attr('transform', 'translate(0,50)')
var ftEnergy = ftGroup.append("text")
    .text("Energy: ")
    .attr('transform', 'translate(0,75)')
var ftSpeech = ftGroup.append("text")
    .text("Speechiness: ")
    .attr('transform', 'translate(0,100)')
var ftInstr = ftGroup.append("text")
    .text("Instrumentalness: ")
    .attr('transform', 'translate(0,125)')
ftGroup.append("text")
    .text("Top Tracks: ")
    .attr('transform', 'translate(0,150)')
var ftTrack1 = ftGroup.append("text")
    .attr('transform', 'translate(0,175)')
var ftTrack2 = ftGroup.append("text")
    .attr('transform', 'translate(0,200)')
var ftTrack3 = ftGroup.append("text")
    .attr('transform', 'translate(0,225)')
var ftTrack4 = ftGroup.append("text")
    .attr('transform', 'translate(0,250)')
var ftTrack5 = ftGroup.append("text")
    .attr('transform', 'translate(0,275)')


// sliders using nouisliders library
var slider = document.getElementById('slider');

// Title
svg.append('text')
    .attr('class', 'title')
    .attr('transform','translate(600,10)')
    .text('Spotify Top Charts');

// constants
var xScale, yScale;

// data used between functions
var data;
var colorMapping;
var artistFeatures;

d3.csv('data/dataframes/monthly_data.csv').then(function(dataset) {
    d3.csv("data/dataframes/artist_track_features.csv").then(function(feature_data) {
        data = dataset;
        artistFeatures = {}
        feature_data.forEach(d => {
            artistFeatures[d["artist"]] = d
            delete artistFeatures[d["artist"]]["artist"]
        });

        // setup slider
        var uniqueArtist = [...new Set(data.map(d => d.artist))]
        noUiSlider.create(slider, {
            start: [0, 100],
            connect: true,
            range: {
                'min': 0,
                'max': uniqueArtist.length
            },
            tooltips: {
                to: function(numericValue) {
                    return numericValue.toFixed(0);
                }
            },
            step: 1,
        })
    
        slider.noUiSlider.on("update", function() {
            var [start, end] = slider.noUiSlider.get(true);
            d3.selectAll(".axes").remove()
            d3.selectAll(".chart").remove()
            updateChart(data, start, end)
        })
    
        updateChart(data);
    })
})

/**
 * Updates chart with axes and line with data
 */
function updateChart(data, start=0, end=100) {
    // Aggregate data by artist
    var artistData = d3.nest() 
        .key(d => d.artist)
        .entries(data);

    // setup color mapping to keep colors the same after filtering
    colorMapping = {}
    for (var [i, d] of artistData.entries()) {
        colorMapping[d.key] = i
    }
    
    // sort artist by time listened
    artistData.sort(
        (a,b) => b.values[b.values.length - 1].ms_played - a.values[a.values.length - 1].ms_played 
    )

    // slice using start and end filters
    artistData = artistData.slice(start, end);
    
    // filter by start and end indices
    var dateDomain = d3.extent(data, d=>d.month)
    var maxTime = d3.max(artistData, d=>parseInt(d.values[d.values.length - 1].ms_played)) / 60000

    addAxes(dateDomain, maxTime)
    addLines(artistData)
}

/**
 * Create lines for line graph
 */
function addLines(artistData) {
    // From stackoverflow: https://stackoverflow.com/questions/10014271/generate-random-color-distinguishable-to-humans
    function selectColor(number) {
        const hue = number * 137.508; // use golden angle approximation
        return `hsl(${hue},50%,75%)`;
    }

    var chart = svg.append("g")
        .attr("class", "chart")

    chart.selectAll(".chartPath")
        .data(artistData)
        .enter()
        .append("path")
        .attr("class", "chartPath")
        .attr("fill", "none")
        .attr("stroke-width", 1.5)
        .attr("id", function(d) {
            return d.key;
        })
        .attr("stroke", function(d,i) {
            return selectColor(colorMapping[d.key]);
        })
        .attr("d", function(d){
            return d3.line()
            .x(function(d) { return xScale(Date.parse(d.month)); })
            .y(function(d) { return Math.floor(yScale(d.ms_played / 60000)); })
            (d.values)
        })
        .on("mouseover", function() {
            d3.selectAll("path")
                .attr("class", "hide")
            var curPath = d3.select(this)
                .attr("class", "show")
            artistName = curPath.data()[0].key
            maxTime = Math.round(curPath.data()[0].values.slice(-1)[0].ms_played / 60000)
            addText(artistName, maxTime)
        })
        .on("mouseout", function() {
            d3.selectAll("path")
                .attr("class", "")
            removeText()
        })
}


/**
 *  Creates scales, axes and axes labels
*/ 
function addAxes(dateDomain, maxTime) {
    xScale = d3.scaleTime()
        .domain([new Date(dateDomain[0]), new Date(dateDomain[1])]).range([100,1200]);

    yScale = d3.scaleLinear()
        .domain([0,maxTime]).range([640,20]);

    var axes = svg.append("g")
        .attr("class", "axes")

    // Create x axis
    axes.append('g').attr('class', 'x_axis')
        .attr('transform', 'translate(0,645)')
        .call(d3.axisBottom(xScale).ticks(d3.timeMonth));

    // Create x grid
    axes.append("g").attr("class", "grid")
        .attr("transform", "translate(0," + 640 + ")")
        .call(d3.axisBottom(xScale).ticks(d3.timeMonth)
            .tickSize(-625)
            .tickFormat("")
        )

    // x axis label
    axes.append('text')
        .attr('class', 'label')
        .attr('transform','translate(600,680)')
        .text('Month');


    // Create y axis
    axes.append('g').attr('class', 'y_axis')
        .attr('transform', 'translate(100,0)')
        .call(d3.axisLeft(yScale));

    // Create y grid
    axes.append("g")			
        .attr("class", "grid")
        .attr('transform', 'translate(100,0)')
        .call(d3.axisLeft(yScale)
            .tickSize(-1100)
            .tickFormat("")
        )

    // y axis label
    axes.append('text')
        .attr('class', 'label')
        .attr('transform','translate(55,350) rotate(-90)')
        .text('Minutes streamed');
}

function addText(artistName, maxTime) {
    d3.selectAll("ftText").remove()
    ftGroup.append("g")
    ftArtist.text("Artist: " + artistName)
    ftTotalTime.text("Minutes streamed: " + maxTime);

    ft = artistFeatures[artistName]
    ftDance.text("Danceability: " + Math.round(ft.danceability * 100) / 100);
    ftEnergy.text("Energy: " + Math.round(ft.energy * 100) / 100);
    ftSpeech.text("Speechiness: " + Math.round(ft.speechiness * 10000) / 10000);
    ftInstr.text("Instrumentalness: " + Math.round(ft.instrumentalness * 10000) / 10000);
    ftTrack1.text(ft[0]);
    ftTrack2.text(ft[1]);
    ftTrack3.text(ft[2]);
    ftTrack4.text(ft[3]);
    ftTrack5.text(ft[4]); 
}

function removeText() {
    ftArtist.text("Artist: ");
    ftTotalTime.text("Minutes streamed: ");
    ftDance.text("Danceability: ");
    ftEnergy.text("Energy: ");
    ftSpeech.text("Speechiness: ");
    ftInstr.text("Instrumentalness: ");
    ftTrack1.text("");
    ftTrack2.text("");
    ftTrack3.text("");
    ftTrack4.text("");
    ftTrack5.text(""); 
}