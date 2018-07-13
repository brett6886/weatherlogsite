//appearance during data fetch
$(document).ajaxStart(function(){
	$("#wait").css("display", "block");
	$("#statTable").hide();
	$("#timeseries-title").hide();
	$("#histogram-title").hide();
	//reset timeseries plots
	Plotly.purge(hPlot);
	Plotly.purge(tPlot);
	Plotly.purge(pPlot);
	//reset histogram plots
	Plotly.purge(hHist);
	Plotly.purge(tHist);
	Plotly.purge(pHist);
});

//normal appearance
$(document).ajaxComplete(function(){
	$("#wait").css("display", "none");
	$("#statTable").show();
	$("#histogram-title").show();
	$("#timeseries-title").show();
});


//gets and converts datetime string inputs into proper format ('yyyy-mm-dd hh:mm:ss')
function getValidDT(){
	
	//read datetimes from input boxes
	var startString = document.getElementById("start").value;
	var endString = document.getElementById("end").value;
	
	//get current datetime -> (yyyy-mm-dd hh:mm:ss) format
	var now = new Date();
	var nowMonth = (((now.getMonth()) < 9 ? "0" : "") + ((now.getMonth()) + 1));
	var nowDate = (((now.getDate()) < 9 ? "0" : "") + (now.getDate()));
	var nowHrs = (((now.getHours()) < 9 ? "0" : "") + (now.getHours()));
	var nowMins = (((now.getMinutes()) < 9 ? "0" : "") + (now.getMinutes()));
	var nowSecs = (((now.getSeconds()) < 9 ? "0" : "") + (now.getSeconds()));
	var nowString = now.getFullYear() + "-" + nowMonth + "-" + nowDate + " " + nowHrs + ":" + nowMins + ":" + nowSecs;
	
	/**handle empty strings**/
	//set starting datetime to earliest data point if empty
	if (startString == "") {
		startString = "2018-06-07 00:00:00";
	}
	//set ending datetime to current if empty
	if (endString == "") {
		endString = nowString;
	}
	
	
	/**handle boundary and order problems**/
	var start = new Date(startString);
	var end = new Date(endString);
	//display error and return failure if dates out of order
	if(start >= end){
		alert("**End time must come after start time");
		return null;
	}

	//date/time must be AFTER initial sensor data (June 7, 2018)
	if (start < new Date("2018-06-07 00:00:00")) {
		startString = "2018-06-07 00:00:00";
	}
	//date/time must be BEFORE current date/time
	if (end > now) {
		endString = nowString;
	}
	
	
	/**Finalize datetime strings -> (yyyy-mm-dd hh:mm:ss) format**/
	//finalize start datetime input 
	var startMonth = (((start.getMonth()) < 9 ? "0" : "") + ((start.getMonth()) + 1));
	var startDate = (((start.getDate()) < 9 ? "0" : "") + ((start.getDate())));
	var startHrs = (((start.getHours()) < 9 ? "0" : "") + ((start.getHours())));
	var startMins = (((start.getMinutes()) < 9 ? "0" : "") + ((start.getMinutes())));
	var startSecs = (((start.getSeconds()) < 9 ? "0" : "") + ((start.getSeconds())));
	startString = start.getFullYear() + "-" + startMonth + "-" + startDate + " " + startHrs + ":" + startMins + ":" + startSecs;
	//finalize end datetime input
	var endMonth = (((end.getMonth()) < 9 ? "0" : "") + ((end.getMonth()) + 1));
	var endDate = (((end.getDate()) < 9 ? "0" : "") + ((end.getDate())));
	var endHrs = (((end.getHours()) < 9 ? "0" : "") + ((end.getHours())));
	var endMins = (((end.getMinutes()) < 9 ? "0" : "") + ((end.getMinutes())));
	var endSecs = (((end.getSeconds()) < 9 ? "0" : "") + ((end.getSeconds())));
	endString = end.getFullYear() + "-" + endMonth + "-" + endDate + " " + endHrs + ":" + endMins + ":" + endSecs;
	
	
	return [startString, endString];
} //end validateDT


//fetches data from database
function getdata(){
	
	//real values
	var datetimes = [];
	var humidities = [];
	var temps = [];
	var pressures = [];


	//stats table values
	var hAvg, tAvg, pAvg;
	var hStdv, tStdv, pStdv;
	

	/**get valid start and end datetimes**/
	var validated = getValidDT();
	//return failure if dates are out of order
	if (validated == null){
		return null;
	}
	var startString = validated[0];
	var endString = validated[1];


	//fetch data from database
	$.ajax({
		type: "POST",
		dataType: "json",
		data: {'start': startString, 'end':endString},
		url: "getdata/",
		success: function(result){
			//real values
			datetimes = result.datetimes.slice(0);
			humidities = result.humidities.slice(0);
			temps = result.temps.slice(0);
			pressures = result.pressures.slice(0);

			//calculate statistics values
			let {mean: hAvg, deviation: hStdv} = stats(humidities);
			let {mean: tAvg, deviation: tStdv} = stats(temps);
			let {mean: pAvg, deviation: pStdv} = stats(pressures);
			
			//set humidity table values
			document.getElementById("hAvg").innerHTML = hAvg + ' %';
			document.getElementById("hStdv").innerHTML = hStdv + ' %';
			//set temperature table values
			document.getElementById("tAvg").innerHTML = tAvg + ' C';
			document.getElementById("tStdv").innerHTML = tStdv + ' C';
			//set pressure table values
			document.getElementById("pAvg").innerHTML = pAvg + ' hPa';
			document.getElementById("pStdv").innerHTML = pStdv + ' hPa';
			
			
			
			//draw plots
			timeplot(datetimes, humidities, "Humidity", "percent", "hPlot"); 
			timeplot(datetimes, temps, "Temperature", "celcius", "tPlot"); 
			timeplot(datetimes, pressures, "Pressure", "hPa", "pPlot");
			hist(humidities, "Humidity", "percent", "hHist"); 
			hist(temps, "Temperature", "celcius", "tHist"); 
			hist(pressures, "Pressure", "hPa", "pHist");
		}, 
		error: function(jqxhr, stat, exception){
			alert("failed to access data");
		}
	});//end ajax()

}//end getdata()


//returns mean and standard deviation of array
function stats(arr) {
	var n = arr.length;
	var sum = 0;
	var mean;
	var variance = 0.0;
	var v1 = 0.0;
	var v2 = 0.0;
	
	//get mean
	arr.map(function(data) {
		sum+=data;
	});
	mean = sum / n;
	
	//get stdv
	if (n > 1) {
		for (var i = 0; i < n; i++) {
			v1 += Math.pow((arr[i] - mean), 2);
			v2 += (arr[i] - mean);
		}

		v2 = v2 * v2 / n;
		variance = (v1 - v2) / (n-1);
		
		if (variance < 0){ 
			variance = 0; 
		}
		
		stddev = Math.sqrt(variance);
	}

	return {
		mean: Math.round(mean * 100)/100,
		deviation: Math.round(stddev * 100)/100
	};
}; //end stats


//draws time series plot with real and simulated values
function timeplot(dates, values, Title, units, div){
	
	var divName = document.getElementById(div);
	
	var trace = [{x: dates, y: values, type: 'bar', name: 'Real data'}];
	
	var layout = {
		title: Title,
		xaxis: {
			title: 'time',
			titlefont: {
				family: 'Courier New, monospace',
				size: 18,
				color: '#7f7f7f'
			},
			type: 'date',
			range: [dates[0], dates[(dates.length) - 1]]
		},
		yaxis: {
			title: units,
			titlefont: {
				family: 'Courier New, monospace',
				size: 18,
				color: '#7f7f7f'
			},
			range: [Math.min.apply(null, values), Math.max.apply(null, values)]
		}
	};

	//time series
	Plotly.newPlot(divName, trace, layout); 

}//end timeplot


//draws time series plot with real and simulated values
function hist(values, Title, units, div){
	
	var divName = document.getElementById(div);
	
	var trace = [{x: values, 
		type: 'histogram', 
		marker: {
			color: "#ff3030"
		}
	}];
	
	var layout = {
		bargap: 0.05, 
		bargroupgap: 0.2, 
		barmode: "overlay", 
		title: Title, 
		xaxis: {
			title: units, 
			titlefont: {
				family: 'Courier New, monospace',
				size: 18,
				color: '#7f7f7f'
			}
		}, 
		yaxis: {
			title: "Quantity",
			titlefont: {
				family: 'Courier New, monospace',
				size: 18,
				color: '#7f7f7f'
			}
		},
		range: [Math.min.apply(null, values), Math.max.apply(null, values)]
	};
	
	//histogram
	Plotly.newPlot(divName, trace, layout);

}//end hist


/**RUN AT PAGE STARTUP*****************************************************************************************/
//initialize start and end date/time inputs
document.getElementById("start").value = "2018-06-12T00:00";
t0 = new Date();
var nowMonth = (((t0.getMonth()) < 9 ? "0" : "") + ((t0.getMonth()) + 1));
var nowDate = (((t0.getDate()) < 9 ? "0" : "") + (t0.getDate()));
var nowHrs = (((t0.getHours()) < 9 ? "0" : "") + (t0.getHours()));
var nowMins = (((t0.getMinutes()) < 9 ? "0" : "") + (t0.getMinutes()));
var nowString = t0.getFullYear() + "-" + nowMonth + "-" + nowDate + "T" + nowHrs + ":" + nowMins;
document.getElementById("end").value = nowString;

//get data on page startup
getdata();
/**************************************************************************************************************/
		