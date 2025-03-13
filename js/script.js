console.log('D3 Version:', d3.version);

// Set the dimensions and margins of the graph
var margin = { top: 40, right: 30, bottom: 60, left: 50 },
    width = 1000 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom;

var regions = {
    'North East - NE England': ['CT', 'ME', 'MA', 'NH', 'RI', 'VT'],
    'North East - Mid Atlantic': ['NY', 'NJ', 'PA'],
    'Mid West - East North Central': ['OH', 'IN', 'IL', 'MI', 'WI'],
    'Mid West - West North Central': ['MN', 'IA', 'MO', 'ND', 'SD', 'NE', 'KS'],
    'South - South Atlantic': ['DE', 'MD', 'DC', 'VA', 'WV', 'NC', 'SC', 'GA', 'FL'],
    'South - East South Central': ['KY', 'TN', 'MS', 'AL'],
    'South - West South Central': ['TX', 'AR', 'LA', 'OK'],
    'West - Mountain': ['MT', 'ID', 'WY', 'NV', 'UT', 'CO', 'AZ', 'NM'],
    'West - Pacific': ['AK', 'WA', 'OR', 'CA', 'HI']
};

var months = ['Average','January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September'];
var yVars = ['TMIN', 'TMAX', 'PRCP'];
var yVarsMatch = {
'TMIN' : 'Tempature Minimum',
'TMAX' : 'Tempature Maximum',
'PRCP' : 'Precipitation'
}

var selectedRegion = 'North East - NE England';
var selectedMonth = 'Average';
var selectedYVar = 'TMIN';
var allData = [];

// Initialize the dropdowns
d3.selectAll('.variable').each(function () {
    let dropdown = d3.select(this);
    let id = dropdown.attr("id");
    let dataSource = id === "region" ? Object.keys(regions) : id === "month" ? months : yVars;

    dropdown.selectAll('option')
        .data(dataSource)
        .enter()
        .append('option')
        .text(d => d)
        .attr('value', d => d);
});

// Load and parse CSV data
function init() {
  d3.csv('data/weather.csv', d => {
      let dateStr = d.date.toString().trim(); // Ensure it's a string
      let year = +dateStr.substring(0, 4);    // Extract year
      let monthIndex = +dateStr.substring(4, 6) - 1; // Extract month (0-based index)
      let day = +dateStr.substring(6, 8);     // Extract day

      return {
          station: d.station,
          state: d.state,
          date: new Date(year, monthIndex, day), // Correct Date object
          TMIN: +d.TMIN,
          TMAX: +d.TMAX,
          TAVG: +d.TAVG,
          AWND: +d.AWND,
          PRCP: +d.PRCP,
          SNOW: +d.SNOW,
          SNWD: +d.SNWD,
          month: months[monthIndex+1] // Assign correct month name
      };
  }).then(data => {
      console.log("Unique Months:", [...new Set(data.map(d => d.month))]); // Debugging
      allData = data;
      updateBoxPlot();
      setBackground(selectedYVar);
  }).catch(error => console.error('Error loading data:', error));
}

// Event listener for dropdown changes
d3.selectAll('.variable').on("change", function () {
    let id = d3.select(this).property("id");
    let value = d3.select(this).property("value");

    if (id === 'region') selectedRegion = value;
    if (id === 'yVar') selectedYVar = value;
    if (id === 'month') selectedMonth = value;

    d3.select("h2").text(selectedRegion + " " + selectedMonth + " " + yVarsMatch[selectedYVar]);
    setBackground(selectedYVar);
    updateBoxPlot();
});

// Create SVG for Box Plot
var svg = d3.select("#boxPlot")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// Function to update the Box Plot with working transitions
function updateBoxPlot() {
    console.log(selectedMonth);
    console.log(selectedRegion);
    console.log(selectedYVar);

    // Filter data for the selected month and region
    let filteredData = allData.filter(d => 
        (selectedMonth === "Average" || d.month === selectedMonth) &&
        regions[selectedRegion].includes(d.state)
    );

    if (filteredData.length === 0) {
        svg.selectAll("*").remove();
        svg.append("text").attr("x", width / 2).attr("y", height / 2)
            .attr("text-anchor", "middle")
            .text("No data available");
        return;
    }

    // Group data by state
    let groupedData = d3.groups(filteredData, d => d.state).map(([state, values]) => {
        let sorted = values.map(d => d[selectedYVar]).sort(d3.ascending);
        return {
            state: state,
            q1: d3.quantile(sorted, 0.25),
            median: d3.quantile(sorted, 0.5),
            q3: d3.quantile(sorted, 0.75),
            min: sorted[0],
            max: sorted[sorted.length - 1]
        };
    });

    // Define color scale based on selected variable
    let colorScale;
    if (selectedYVar === 'TMIN' || selectedYVar === 'TMAX') {
        colorScale = d3.scaleLinear()
            .domain([30, 80])  // Set domain from 20 to 90 for temperature
            .range(["darkblue", "red"]);
    } else if (selectedYVar === 'PRCP') {
        colorScale = d3.scaleLinear()
            .domain([.00, .02])  // Scale based on precipitation values (0 to 1)
            .range(["lightblue", "darkblue"]);
    }

    const regionStates = regions[selectedRegion].slice(); // Create a copy to avoid modifying the original

    // Now use these ordered states for your x scale, but only if they have data
    
    let x = d3.scaleBand()
        .domain(regionStates.filter(state => groupedData.some(d => d.state === state)))
        .range([0, width])
        .padding(0.2);

    // Set Y scale domain based on the selected variable
    let y;
    if (selectedYVar === 'TMIN' || selectedYVar === 'TMAX') {
        y = d3.scaleLinear()
            .domain([-15, 90]) // Set domain for TMIN and TMAX
            .range([height, 0]);
    } else if (selectedYVar === 'PRCP') {
        y = d3.scaleLinear()
            .domain([0, .4])  // Set domain for PRCP
            .range([height, 0]);
    }

    // Update axes (remove and recreate these for simplicity)
    svg.selectAll(".axis").remove();
    // Update axes (remove and recreate these for simplicity)
svg.selectAll(".axis-label").remove(); // Remove old labels before adding new ones

svg.append("g")
    .attr("class", "axis x-axis")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

// Add X-axis label
svg.append("text")
    .attr("class", "axis-label")
    .attr("x", width / 2)
    .attr("y", height + 50)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .text("States");

// Add Y-axis
svg.append("g")
    .attr("class", "axis y-axis")
    .call(d3.axisLeft(y));

// Add Y-axis label (dynamic based on selected variable)
svg.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -40)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .text(yVarsMatch[selectedYVar])



    // Select all box groups with data binding
    let boxes = svg.selectAll(".box")
        .data(groupedData, d => d.state);

    // EXIT phase - remove old elements with transition
    boxes.exit()
        .transition()
        .duration(500)
        .style("opacity", 0)
        .remove();

    // ENTER phase - create new boxes with initial properties
    let newBoxes = boxes.enter()
        .append("g")
        .attr("class", "box")
        .attr("transform", d => `translate(${x(d.state)}, 0)`)
        .style("opacity", 0);  // Start with opacity 0 for fade-in

    // Add rectangles to new boxes
    newBoxes.append("rect")
        .attr("x", 0)
        .attr("width", x.bandwidth())
        .attr("y", d => y(d.q3))
        .attr("height", d => y(d.q1) - y(d.q3))
        .attr("fill", d => colorScale(d.median))
        .attr("stroke", "black");

    // Add median lines to new boxes
    newBoxes.append("line")
        .attr("x1", 0)
        .attr("x2", x.bandwidth())
        .attr("y1", d => y(d.median))
        .attr("y2", d => y(d.median))
        .attr("stroke", "black")
        .attr("stroke-width", 2);

    // Fade in new boxes
    newBoxes.transition()
        .duration(500)
        .style("opacity", 1);

    // UPDATE phase - transition existing elements to new positions/styles
    let updateBoxes = boxes.transition()
        .duration(500)
        .attr("transform", d => `translate(${x(d.state)}, 0)`);

    // Update the rectangles
    boxes.select("rect")
        .transition()
        .duration(500)
        .attr("width", x.bandwidth())
        .attr("y", d => y(d.q3))
        .attr("height", d => y(d.q1) - y(d.q3))
        .attr("fill", d => colorScale(d.median));

    // Update the median lines
    boxes.select("line")
        .transition()
        .duration(500)
        .attr("x1", 0)
        .attr("x2", x.bandwidth())
        .attr("y1", d => y(d.median))
        .attr("y2", d => y(d.median));

    // Add tooltip interaction
    newBoxes.on("mouseover", function(event, d) {
        let tooltip = d3.select("#tooltip");
        tooltip.style("display", "block")
            .html(`${d.state}: ${d[selectedYVar] === 'TMIN' ? d.q1 : d[selectedYVar] === 'TMAX' ? d.q3 : d.median}`)
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY - 25}px`);
    })
    .on("mouseout", function() {
        d3.select("#tooltip").style("display", "none");
    });
}

function setBackground(yVar) {
    
    let backgroundImage;
    if (yVar === 'TMAX') {
        backgroundImage = 'url("images/Sun.png")'; // Set to Sun.png for TMAX
    } else if (yVar === 'PRCP') {
        backgroundImage = 'url("images/rain.png")'; // Set to Rain.png for PRCP
    } else {
        backgroundImage = 'url("images/Cold.png")'; // Default to Cold.png for other variables
    }
    // Apply the background image to the body or a specific element
    document.body.style.backgroundImage = backgroundImage;
    document.body.style.backgroundSize = 'contain'; // or use 'cover' for resizing
    document.body.style.backgroundRepeat = 'no-repeat'; // Prevent repeat
    document.body.style.backgroundPosition = 'center';
}

window.addEventListener('load', init);
