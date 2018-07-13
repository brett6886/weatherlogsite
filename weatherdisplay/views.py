from django.shortcuts import render
from django.http import JsonResponse
import mysql.connector as conn
import sshtunnel
import time
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
            qStr = "SELECT * FROM weatherVars WHERE date >= \'" + startDate \
                + "\' AND date <= \'" + endDate \
                + "\' AND time >= \'" + startTime \
                + "\' AND time <= \'" + endTime + "\';"  
            query2 = (qStr)
            c.execute(query2)
            for line in c:
                datetimes.append('{} {}'.format(line[1], line[2]))
                humidities.append(line[3])
                temps.append(line[4])
                pressures.append(line[5])
            c.close()
            
            
            #add all lists to dictionary (first 4 values in database are just 0)
            data['datetimes'] = datetimes[4:]
            data['humidities'] = humidities[4:] 
            data['temps'] = temps[4:]
            data['pressures'] = pressures[4:]
            

            #close database connections
            db.close()
            db = None
            ##end with-as
    
        
        #allow half-second break between fetch attempts
        time.sleep(0.5)
        ##end while loop
    
    
    
    #return all data as json object
    return JsonResponse(data)


