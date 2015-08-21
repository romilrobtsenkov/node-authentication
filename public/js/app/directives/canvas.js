(function() {
  'use strict';

  angular
    .module('app')
    .directive('scenarioeditcanvas', scenarioeditcanvas);

    scenarioeditcanvas.$inject = ['$routeParams','$timeout','$window'];

    function scenarioeditcanvas ($routeParams,$timeout,$window) {
      return {
  			restrict: 'E',
        templateUrl: 'js/app/directives/canvas.html',
  			link: function postLink($scope, element, attrs) {

          var isTouch = !!('ontouchstart' in window);
          var point = {x: 0, y: 0};

    			var P_START = isTouch ? 'touchstart' : 'mousedown';
    			var P_MOVE = isTouch ? 'touchmove' : 'mousemove';
    			var P_END = isTouch ? 'touchend' : 'mouseup';

          var canvas = document.createElement('canvas');
          canvas.id = 'scenario-edit-canvas';
          var temp_canvas = document.createElement('canvas');
          temp_canvas.id = 'scenario-edit-canvas-tmp';
          var image = new Image();
          image.id = 'scenario-edit-canvas-image';

          angular.element(temp_canvas).css({
            position: 'absolute',
            top: 0,
            left: 0,
          });

          angular.element(image).css({
            display: 'none',
          });



          element.find('div').append(temp_canvas);
          element.find('div').append(canvas);
          element.find('div').append(image);

          var LEPLANNER = {

          	WIDTH: 1920,
          	HEIGHT: 1080,
            scale: null,
          	canvas: null,
            temp_canvas: null,
            image: null,
          	ctx: null,
            temp_ctx: null,
            activities: null,
            activities_duration: null,
            activities_width: null,
            enlarged_activity: null,

          	init: function(){

              this.canvas = canvas;
              this.temp_canvas = temp_canvas;
              this.image = image;
              this.activities = [];
              this.activities_duration = $scope.scenario.activities_duration;

              this.canvas.width =  this.temp_canvas.width  = this.WIDTH;
              this.canvas.height = this.temp_canvas.height = this.HEIGHT;

              this.ctx = canvas.getContext('2d');
      				this.temp_ctx = temp_canvas.getContext('2d');
              this.resizeCanvas();
              this.Draw.clear(this.ctx);
              this.drawBaseLayer();
              this.drawActivities();
              this.updateImageUrl();

          	},

            resizeCanvas: function(){
              var canvas_wrapper = document.getElementById('scenario-edit-canvas-wrapper');
              var style = {
                width: canvas_wrapper.offsetWidth
              };
              angular.element(canvas).css(style);
              angular.element(temp_canvas).css(style);

              //!important scale
              this.scale = this.WIDTH/style.width;
            },

            updateImageUrl: function(){
              image.src = this.canvas.toDataURL("image/png");
            },

            drawBaseLayer: function(){

              //bg
              this.Draw.fillRect(this.ctx, 0, 0, LEPLANNER.WIDTH, LEPLANNER.HEIGHT, 'rgba(255,255,255,1)');

              //bg-border
              this.Draw.strokeRect(this.ctx, 0, 0, LEPLANNER.WIDTH, LEPLANNER.HEIGHT, 1, 'rgba(0,0,0,1)');


              //middle divider
              this.Draw.line(this.ctx, 0, this.HEIGHT/2, this.WIDTH, this.HEIGHT/2, 1, 'rgba(0,0,0,1)');

              // legend
              var legend_x = 50;
              var legend_y = LEPLANNER.HEIGHT-100;
              var legend_box = 20;

              this.Draw.fillRect(this.ctx, legend_x, legend_y, legend_box, legend_box, 'rgba(201, 218,	184, 1)');
              this.Draw.text(this.ctx, 'tunnis (in-class)', legend_x + legend_box*2, legend_y+legend_box-2, legend_box, 'rgba(0,0,0,1)');
              legend_y += 40;

              this.Draw.fillRect(this.ctx, legend_x, legend_y, legend_box, legend_box, 'rgba(239, 200, 155, 1)');
              this.Draw.text(this.ctx, 'kodutöö (off-class)', legend_x + legend_box*2, legend_y+legend_box-2, legend_box, 'rgba(0,0,0,1)');

              // student/teacher



            },

            drawActivities: function(){

              if($scope.scenario.activities.length === 0 ||
                ($scope.scenario.activities.length === 1 && $scope.scenario.activities[0].duration === 0)){
                this.Draw.text(this.ctx, 'Please add more activity (duration)', 50*this.scale, 50*this.scale, 20*this.scale, 'rgba(0,0,0,1)');
                return;
              }

              var start_time = 0;

              for(var i = 1; i <= $scope.scenario.activities.length; i++){

                var Activity = new LEPLANNER.Activity(i, start_time, $scope.scenario.activities[i-1]);
                this.activities.push(Activity);
                Activity.Draw();
                start_time += $scope.scenario.activities[i-1].duration;
              }

              console.log($scope.scenario.activities);
            }

          };

          LEPLANNER.Activity = function(indent, start_time, data){

            this.indent = indent;
            this.start_time = start_time;
            this._id = data._id;
          	this.name = data.name;
          	this.duration = data.duration;
            if(typeof data.in_class == 'undefined'){
              this.in_class = false;
            }else{
              this.in_class = true;
            }
            this.organization = data.activity_organization._id;
            this.outcomes = data.outcomes;

            //for drawing
            this.padding = 20;
            this.height = 40;
            // - 20 is to give padding from left side
            var minute_constant = ((LEPLANNER.WIDTH-160-(($scope.scenario.activities.length+1)*this.padding))/LEPLANNER.activities_duration);
            this.x = parseInt(80+(minute_constant * this.start_time) + (this.indent* this.padding));
            this.y = parseInt(LEPLANNER.HEIGHT/2-this.height/2);
            this.width = parseInt(minute_constant * this.duration);

            //for enlarged drawing
            this.enlarged_x = null;
            this.enlarged_y = null;
            this.enlarged_width = null;
            this.enlarged_height = null;

          	this.Draw = function(){

              var class_color;
              if(this.in_class){
                // green
                class_color = 'rgba(220,241,219, 1)';
              }else{
                class_color = 'rgba(248, 211, 212, 1)';
              }
              //draw box
              LEPLANNER.Draw.fillRect(LEPLANNER.ctx, this.x, this.y, this.width, this.height, class_color);
              LEPLANNER.Draw.strokeRect(LEPLANNER.ctx, this.x, this.y, this.width, this.height, 1, 'rgba(0,0,0,1)');

              //write duration
              var duration_font = 19;
              LEPLANNER.Draw.text(LEPLANNER.ctx, this.duration, this.x+duration_font/4, this.y+duration_font, duration_font, 'rgba(0,0,0,1)');

              //write name
              var name_font = 25;
              LEPLANNER.Draw.activityName(LEPLANNER.ctx, this.name, this.width-name_font-7, this.x+name_font+7, this.y+name_font, name_font, 'rgba(0,0,0,1)');

          	};

            this.EnlargeOne = function(){

              LEPLANNER.Draw.clear(LEPLANNER.temp_ctx);

              var class_color;
              if(this.in_class){
                // green
                class_color = 'rgba(220,241,219, 1)';
              }else{
                class_color = 'rgba(248, 211, 212, 1)';
              }

              var bigger = 40;

              this.enlarged_x = this.x-bigger*2;
              this.enlarged_y = this.y-bigger*1.5;
              this.enlarged_width = this.width + bigger*4;
              this.enlarged_height = this.height + bigger*3;

              //draw box
              LEPLANNER.Draw.fillRect(LEPLANNER.temp_ctx, this.enlarged_x, this.enlarged_y, this.enlarged_width, this.enlarged_height, class_color);
              LEPLANNER.Draw.strokeRect(LEPLANNER.temp_ctx, this.enlarged_x, this.enlarged_y, this.enlarged_width, this.enlarged_height, 1, 'rgba(0,0,0,1)');

              //write duration
              var duration_font = 19;
              LEPLANNER.Draw.text(LEPLANNER.temp_ctx, this.duration, this.enlarged_x+duration_font/4, this.enlarged_y+duration_font, duration_font, 'rgba(0,0,0,1)');

              //write name in lines
              var name_font = 25;
              var words = this.name.split(' ');
              var line = '';
              var y = this.enlarged_y+name_font;
              var lineHeight = name_font;
              //75 fixing overflow
              var maxWidth = this.enlarged_width-name_font-75;
              for(var n = 0; n < words.length; n++) {
                var testLine = line + words[n] + ' ';
                var metrics = LEPLANNER.temp_ctx.measureText(testLine);
                var testWidth = metrics.width;
                if (testWidth > maxWidth && n > 0) {
                  LEPLANNER.Draw.text(LEPLANNER.temp_ctx, line, this.enlarged_x+name_font+7, y, name_font, 'rgba(0,0,0,1)');
                  line = words[n] + ' ';
                  y += lineHeight;
                }
                else {
                  line = testLine;
                }
              }
              LEPLANNER.Draw.text(LEPLANNER.temp_ctx, line, this.enlarged_x+name_font+7, y, name_font, 'rgba(0,0,0,1)');

              // draw add material buttons
              LEPLANNER.Draw.addMaterialButton(LEPLANNER.temp_ctx, this.enlarged_x+this.enlarged_width/2, this.enlarged_y, 50, 'rgba(255,255,255,1)', false);
              LEPLANNER.Draw.addMaterialButton(LEPLANNER.temp_ctx, this.enlarged_x+this.enlarged_width/2, this.enlarged_y+this.enlarged_height, 50, 'rgba(255,255,255,1)', true);


              //LEPLANNER.Draw.activityName(LEPLANNER.temp_ctx, this.name, this.enlarged_width-name_font-7, this.enlarged_x+name_font+7, this.enlarged_y+name_font, name_font, 'rgba(0,0,0,1)');
            };

          };

          LEPLANNER.checkIfHoveringActivity = function(){

            //fix 1920px canvas width
            point.x = point.x*LEPLANNER.scale;
            point.y = point.y*LEPLANNER.scale;

            var hovering = false;

            for(var i = 0; i < LEPLANNER.activities.length; i++){
              var a = LEPLANNER.activities[i];
              if ((point.x>=a.x)&(point.x<=a.x+a.width)&(point.y>=a.y)&(point.y<=a.y+a.height)){

                if(LEPLANNER.enlarged_activity != a._id){
                  LEPLANNER.activities[i].EnlargeOne();
                  LEPLANNER.enlarged_activity = a._id;
                }

                hovering = true;

              }

              if(LEPLANNER.enlarged_activity == a._id){
                //check if hovering enlarged part

                if ((point.x>=a.enlarged_x)&(point.x<=a.enlarged_x+a.enlarged_width)&(point.y>=a.enlarged_y)&(point.y<=a.enlarged_y+a.enlarged_height)){
                  console.log('true');
                  hovering = true;
                }

              }

            }

            if(LEPLANNER.enlarged_activity !== null && hovering === false){
              LEPLANNER.enlarged_activity = null;
              LEPLANNER.Draw.clear(LEPLANNER.temp_ctx);
            }

          };

          LEPLANNER.Draw = {

            clear: function(ctx) {
                ctx.clearRect(0, 0, LEPLANNER.WIDTH, LEPLANNER.HEIGHT);
            },

            line: function(ctx, x, y, end_x, end_y, lw, col){
              ctx.fillStyle = col;
              ctx.lineWidth=lw;
              ctx.moveTo(x, y);
              ctx.lineTo(end_x, end_y);
              ctx.stroke();
            },

            fillRect: function(ctx, x, y, w, h, col) {
                ctx.fillStyle = col;
                ctx.lineJoin = "miter";
                ctx.fillRect(x, y, w, h);
            },

            fillRectRound: function(ctx, x, y, w, h, lw, col) {
                ctx.fillStyle = col;
                ctx.strokeStyle = col;
                ctx.lineJoin = "round";
                ctx.lineWidth=lw;
                ctx.strokeRect(x+(lw/2), y+(lw/2), w-lw, h-lw);
                ctx.fillRect(x+(lw/2), y+(lw/2), w-lw, h-lw);
            },

            strokeRect: function(ctx, x, y, w, h, lw, col) {
                ctx.strokeStyle = col;
                ctx.lineJoin = "miter";
                ctx.lineWidth=lw;
                ctx.strokeRect(x, y, w, h);
            },

            circle: function(ctx, x, y, r, col) {
                ctx.fillStyle = col;
                ctx.beginPath();
                ctx.arc(x + 5, y + 5, r, 0,  Math.PI * 2, true);
                ctx.closePath();
                ctx.fill();
            },

            addMaterialButton: function(ctx, x, y, r, fill_col, rotate) {
                //ctx.fillStyle = fill_col;
                var greenPart = ctx.createLinearGradient(x,y-30,x,y+30);

                //bottom
                if(rotate){
                  greenPart = ctx.createLinearGradient(x,y+30,x,y-30);
                }

                greenPart.addColorStop(0, 'rgb(92,184,92)');
                greenPart.addColorStop(1, 'rgb(65,150,65)');

                var width = 50;
                ctx.lineWidth = width;

                // First we make a clipping region for the left half
                ctx.save();
                ctx.beginPath();
                ctx.rect(x-width, y-width, 100+width, 100 + width*2);
                ctx.clip();

                // Then we draw the left half
                ctx.strokeStyle = greenPart;
                ctx.beginPath();
                ctx.arc(x,y,25,Math.PI, 0, rotate);
                ctx.stroke();

                ctx.restore(); // restore clipping region to default


                ctx.fillStyle = fill_col;
                var font_size = 50;
                ctx.font = font_size+'px Helvetica';
                if(rotate){
                  ctx.fillText('+', x-15, y+34);
                }else{
                  ctx.fillText('+', x-15, y-7);
                }

            },

            text: function(ctx, string, x, y, size, col) {
                ctx.font = size+'px Helvetica';
                ctx.fillStyle = col;
                ctx.fillText(string, x, y);
            },

            activityName: function(ctx, string, box_width, x, y, size, col) {
                ctx.font = size+'px Helvetica';

                var text_width = ctx.measureText(string).width;

                if(text_width > box_width){

                  var new_length = Math.floor((text_width-(text_width-box_width)) * (string.length) / text_width);

                  if((new_length-1) <= 0){
                    return;
                  }
                  string = string.slice(0, new_length-1);
                }

                ctx.fillStyle = col;
                ctx.fillText(string, x, y);
            }

          };

          angular.element($window).ready(function() {
            LEPLANNER.init();
          });

          angular.element($window).bind('resize', function () {
            LEPLANNER.resizeCanvas();
          });

          temp_canvas.addEventListener(P_MOVE, function(e) {

            //https://github.com/pwambach/angular-canvas-painter/blob/master/js/pwCanvas.js
            setPointFromEvent(point, e);
            LEPLANNER.checkIfHoveringActivity();
          });

          var getOffset = function( elem ) {
            var offsetTop = 0;
            var offsetLeft = 0;
            do {
              if(!isNaN(elem.offsetLeft)) {
                offsetTop += elem.offsetTop;
                offsetLeft += elem.offsetLeft;
              }
              elem = elem.offsetParent;
            } while( elem );
              return {
                left:offsetLeft,
                top: offsetTop
              };
          };

          var setPointFromEvent = function(point, e) {
  					if(isTouch){
  						point.x = e.changedTouches[0].pageX - getOffset(e.target).left;
  						point.y = e.changedTouches[0].pageY - getOffset(e.target).top;
  					} else {
  						point.x = e.offsetX !== undefined ? e.offsetX : e.layerX;
  						point.y = e.offsetY !== undefined ? e.offsetY : e.layerY;
  					}
  				};


  			}
  		};

    }

}());
