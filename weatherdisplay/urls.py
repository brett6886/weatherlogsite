

from django.conf.urls import url
from . import views
from django.views.decorators.csrf import csrf_exempt
from django.conf.urls.static import static
from django.conf import settings

urlpatterns = [
    url(r'^$', views.home, name='home'),
    url(r'getdata/$', csrf_exempt(views.getdata), name='getdata'),
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)