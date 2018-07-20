//*********************************************************

emptyData = false;

//appearance during data fetch
$(document).ajaxStart(function(){
	$("#wait").css("display", "block");
	$("#statTable").hide();
	$("#timeseries-title").hide();
	$("#histogram-title").hide();
	document.getElementById("err").innerHTML = "";
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
	if(!emptyData){ $("#statTable").show();}
	$("#histogram-title").show();
	$("#timeseries-title").show();
});




//gets and converts datetime string inputs into proper format ('yyyy-mm-dd hh:mm:ss')
function getValidDT(){

    //date of initial sensor reading (June 08, 2018)
    sensorBegin = new Date("2018-06-08 12:41:00");

    //get current datetime
	var now = new Date();
    nowString = inputFormat(now);

	//get starting datetime
	var startString = document.getElementById("start").value;

	//get ending datetime
	var endString = document.getElementById("end").value;


	/**handle empty strings**/
	if(!(startString.includes("T"))){
        alert("**Invalid Start Date");
		return null;
    }
    if(!(endString.includes("T"))){
        alert("**Invalid End Date");
		return null;
    }



	/**handle boundary and order problems**/
	var start = new Date(startString);
	var end = new Date(endString);
	//display error and return failure if dates out of order
	if(start >= end){
		alert("**End time must come after start time");
		return null;
	}
	else{
	    //change start date to initial sensor reading if too far in the past
	    if(start < sensorBegin){
	        alert("**No data collected prior to 06/08/2018 12:41 PM");
	        start = sensorBegin;
	        document.getElementById("start").value = inputFormat(sensorBegin);

	        //change end date to today if too far in the future
	        if(end < sensorBegin){
    	        end = now;
        		document.getElementById("end").value = nowString;
	        }
	    }

	    //set end to current time if it's in the future
	    if (end > now) {
    		end = now;
    		document.getElementById("end").value = nowString;
	    }

	    //get at least 2 data points
        if (((end - start)/60000.0) < 10){
            end = new Date((start.getTime() + 10*60000));
            document.getElementById("end").value = inputFormat(end);
            console.log("new end time: " + end.toString());
        }
	}


	/**Finalize datetime strings -> (yyyy-mm-dd hh:mm:ss) format**/
	//finalize start datetime input
	startString = djangoFormat(start);
	//finalize end datetime input
	endString = djangoFormat(end);


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
	if (validated == null) { return null; }
	var startString = validated[0];
	var endString = validated[1];


	//fetch data from database
	$.ajax({
		type: "POST",
		dataType: "json",
		data: {'start': startString, 'end':endString},
		url: "getdata/",
		success: function(result){


		    //set error message if query returned empty
		    if (result.datetimes === null){
		        console.log("***Data query returned empty");
		        emptyData = true;
		        document.getElementById("err").innerHTML = "No data available for that time period";
		        return null;
		    }
		    //log number of data points fetched
		    else{
                console.log("***number of data points fetched: " + result.datetimes.length);
		        emptyData = false;
		        document.getElementById("err").innerHTML = "";
		    }


			//get real values
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
			timeplot(datetimes, humidities, "percent", "hPlot");
			timeplot(datetimes, temps, "celcius", "tPlot");
			timeplot(datetimes, pressures, "hPa", "pPlot");
			hist(humidities, "percent", "hHist");
			hist(temps, "celcius", "tHist");
			hist(pressures, "hPa", "pHist");
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




//draws time series plot
function timeplot(dates, values, units, div){

	var divName = document.getElementById(div);

	var trace = [{x: dates, y: values, type: 'bar', name: 'Real data'}];

	var layout = {
		title: "Time Series",
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
			range: [0, Math.max.apply(null, values)]
		}
	};

	//time series
	Plotly.newPlot(divName, trace, layout);

}//end timeplot




//draws time series plot
function hist(values, units, div){

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
		title: "Histogram",
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
		range: [0, Math.max.apply(null, values)]
	};

	//histogram
	Plotly.newPlot(divName, trace, layout);

}//end hist




//get input-formatted string from date (aka the format accepted by the user input box)
function inputFormat(date){

    var dateMonth = ((date.getMonth() < 9 ? "0" : "") + (date.getMonth() + 1));
    var dateDate = ((date.getDate() < 9 ? "0" : "") + date.getDate());
    var dateHrs = ((date.getHours() < 9 ? "0" : "") + date.getHours());
    var dateMins = ((date.getMinutes() < 9 ? "0" : "") + date.getMinutes());
    var formatted = date.getFullYear() + "-" + dateMonth + "-" + dateDate + "T" + dateHrs + ":" + dateMins;

    return formatted;
}




//get django-formatted string from date
function djangoFormat(date){

    var dateMonth = (((date.getMonth()) < 9 ? "0" : "") + ((date.getMonth()) + 1));
	var dateDate = (((date.getDate()) < 9 ? "0" : "") + ((date.getDate())));
	var dateHrs = (((date.getHours()) < 9 ? "0" : "") + ((date.getHours())));
	var dateMins = (((date.getMinutes()) < 9 ? "0" : "") + ((date.getMinutes())));
	var dateSecs = (((date.getSeconds()) < 9 ? "0" : "") + ((date.getSeconds())));
	var formatted = date.getFullYear() + "-" + dateMonth + "-" + dateDate + " " + dateHrs + ":" + dateMins + ":" + dateSecs;

    return formatted;
}




/**RUN AT PAGE STARTUP*****************************************************************************************/
//stat table and error message initially not visible
$("#statTable").hide();
document.getElementById("err").innerHTML = "";

//set the start-date-input to first sensor reading date
document.getElementById("start").value = "2018-06-08T12:41";

//set end-date-input to current date
endt = new Date();
document.getElementById("end").value = inputFormat(endt);

//fetch data
window.onload = getdata;
/**************************************************************************************************************/
