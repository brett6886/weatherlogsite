from django.shortcuts import render
from django.http import JsonResponse
import mysql.connector as conn
import sshtunnel
import time
from datetime import datetime as dt
from datetime import timedelta
import statistics as stats
import numpy as np
import weatherdisplay.config as conf




#home page view
def home(request):
    
    return render(request, 'weatherdisplay/home.html', {})





#data fetch view
def getdata(request):
    
    data = {} #holds all data
    datetimes = []
    humidities = []
    temps = []
    pressures = []
    
    #get date/time range from user input
    start = request.POST.get('start')
    end = request.POST.get('end')
    #split dates and times
    startDate, startTime = start.split()
    endDate, endTime = end.split()
    
    #set max timeout
    sshtunnel.SSH_TIMEOUT = 5.0
    sshtunnel.TUNNEL_TIMEOUT = 5.0


    #keep fetching until successful
    while len(datetimes) == 0 or len(humidities) == 0 or len(temps) == 0 or len(pressures) == 0:

        #create ssh tunnel to cloud server
        with sshtunnel.SSHTunnelForwarder(
            ("ssh.pythonanywhere.com"),
            ssh_password = conf.ssh_password,
            ssh_username = conf.ssh_username,
            remote_bind_address=('iambrett.mysql.pythonanywhere-services.com', 3306)
        ) as tunnel:
            #connect to cloud database
            db = conn.connect(
                host = "127.0.0.1",
                user = conf.user,
                password = conf.password,
                port = tunnel.local_bind_port,
                database = "iambrett$weatherlog")



            #read data from database
            c = db.cursor()
            qStr = "SELECT * FROM weatherVars WHERE date >= \'" + startDate + "\' AND date <= \'" + endDate + "\';"
            print('***** ', qStr)
            query2 = (qStr)
            c.execute(query2)
            for line in c:
                datetimes.append('{} {}'.format(line[1], line[2]))
                humidities.append(line[3])
                temps.append(line[4])
                pressures.append(line[5])
            c.close()
            
            #print('****\n', len(datetimes), '  ', len(humidities), '  ', len(temps), '  ', len(pressures))
            
            #add all lists to dictionary (first 4 values in database are just 0)
            data['datetimes'] = datetimes[4:]
            data['humidities'] = humidities[4:] 
            data['temps'] = temps[4:]
            data['pressures'] = pressures[4:]
            
            #add sim data to dictionary
            data['simDates'], data['hSims'], data['tSims'], data['pSims'] = getSims(datetimes[4], datetimes[-1], humidities[4:], temps[4:], pressures[4:])


            #close database connections
            db.close()
            db = None
            ##end with-as
            
    
        
        #allow half-second break between fetch attempts
        time.sleep(0.5)
        ##end while loop
    
    
    
    #return all data as json object
    return JsonResponse(data)







# Returns simulated data corresponding to date-times between 'start'
# and 'end' in 5-minute intervals
def getSims(start, end, hum, temp, press):
    
    simDates = []
    hSims = []
    tSims = []
    pSims = []
    
    #convert start/end strings to datetime objects
    t0 = dt.strptime(start, "%Y-%m-%d %H:%M:%S")
    tfinal = dt.strptime(end, "%Y-%m-%d %H:%M:%S")
    
    #calculate all mean and stdv values
    havg, hstdv = stats.mean(hum), stats.stdev(hum)
    tavg, tstdv = stats.mean(temp), stats.stdev(temp)
    pavg, pstdv = stats.mean(press), stats.stdev(press)
    
    t = 0
    p = 0
    A = np.random.normal(1.8,0.4)
    #create sim data in 5-minute intervals 
    while t0 <= tfinal:
        hRand = np.random.normal(havg, hstdv)
        tRand = np.random.normal(tavg, tstdv)
        #pRand = np.random.normal(pavg, pstdv)
        pRand = pavg + A * np.sin(0.45*t - p) + 0.3 * np.sin(0.015*t - p) + np.random.normal(0,0.1)
        t += .1
        
        hSims.append(hRand)
        tSims.append(tRand)
        pSims.append(pRand)
        
        simDates.append(t0.strftime("%Y-%m-%d %H:%M:%S"))
        t0 += timedelta(minutes = 5)
        
        
    return simDates, hSims, tSims, pSims
