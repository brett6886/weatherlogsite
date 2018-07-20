from django.shortcuts import render
from django.http import JsonResponse
import mysql.connector as conn
import sshtunnel
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

    #get date/time range from user input (format 'yyyy-mm-dd hh:mm:ss')
    start = request.POST.get('start')
    end = request.POST.get('end')
    print('\n***start date:', start)
    print('***end date:', end)

    #set max timeout
    sshtunnel.SSH_TIMEOUT = 5.0
    sshtunnel.TUNNEL_TIMEOUT = 5.0


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
        qStr = "SELECT * FROM weatherVars WHERE datetimes >= \'" + start + "\' AND datetimes <= \'" + end + "\';"
        query2 = (qStr)
        c.execute(query2)
        for line in c:
            datetimes.append('{}'.format(line[1]))
            humidities.append(line[2])
            temps.append(line[3])
            pressures.append(line[4])
        c.close()


        #return Nothing if no sufficient data found in database
        print('***Number of datapoints fetched:', len(datetimes), '\n')
        if(len(datetimes) < 2):
            data['datetimes'] = None
            data['humidities'] = None
            data['temps'] = None
            data['pressures'] = None
            return JsonResponse(data)


        #add all lists to dictionary
        data['datetimes'] = datetimes
        data['humidities'] = humidities
        data['temps'] = temps
        data['pressures'] = pressures


        #close database connections
        db.close()
        db = None
        ##end with-as




    #return all data as json object
    return JsonResponse(data)




