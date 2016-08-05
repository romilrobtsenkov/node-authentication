# LePlanner beta

## Setup (Ubuntu 16)
* install [nginx](http://nginx.org)
* configure nginx to to share `/public` folder for domain and to share `/api` route to node server port
```
# example.config
server {
  listen 80;
  server_name exampledomain.com;
  index index.html index.html;

  location / {
    root  /leplanner-beta/public;
    autoindex off;
  }

  location /api {
    proxy_pass http://localhost:3000;
  }
}
```
* install npm packages
* install bower packages
* create `config/config.js`
```javascript
//congig.js
var config = {};

config.port = 3000; //port, default 3000
config.db = ''; // mongodb://[username:password@]host1[:port1][/[database][?options]]
config.secret = ''; // cookie secret
config.cookieMaxAge = 30 * 24 * 3600 * 1000; // 30 days
config.profile_image_upload_path = './public/images/user/';
config.profile_image_upload_temp_path = './public/images/user-temp/';
config.scenarios_thumb_upload_path = './public/images/scenario-thumbs/';
config.site_url = ''; //site URL, example http://leplanner-beta.romil.ee
config.email = ''; // password reset emails sender
config.developer_email = ''; // critical error email will be sent here

config.errorMails = true; // email developer on critical error

// for logger.js
config.log = {
	level: 7,
	appName: 'LePlanner'
};

module.exports = config;
```

## Create required folders
```
/public/images/user/
/public/images/user-temp/
/public/images/scenario-thumbs/
```

## Run from console
```
node bin/www
```
PS! use [pm2](http://pm2.keymetrics.io) for better control  
