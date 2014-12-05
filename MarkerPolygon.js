/**
 *	MarkerPolygon - additional component for HereMaps
 *	@author: Andre Rodrigues (andrecr12@hotmail.com) 
 * 
 */

var MarkerPolygon = function (display, $container, props) {
	// Call the "super" constructor to initialize properties inherited from Container
	nokia.maps.map.Container.call(this);

	// Calling MarkerPolygon constructor
	this.init(display, $container, props);
};

// MarkerPolygon constructor function 
MarkerPolygon.prototype.init = function (display, map, props) {
	this.display = display;
	this.map = map;
	this.lineProps = props.polygon;
	this.markerProps = props.marker;
	this.editingIndex = -1;
	this.markerRadius = 5;
	this.markersAlpha = '0.6';
	this.editable = true;

	/*	Fix this */
	this.divDraggable = this.map.find('div[draggable="true"][aria-role!="button"]');

	this.xyCoords = [];

	//create canvas element
	this.canvas = $('<canvas>');
	var zindexAux = parseInt( this.map.css('z-index'), 10 ) + 1;
	var topAux = this.map[0].offsetTop;
	var leftAux = this.map[0].offsetLeft;
	this.canvas.css({'position': 'absolute', 'display': 'none', 'z-index': zindexAux, 'top': topAux, 'left': leftAux});
	this.canvas.appendTo(this.map);

	this.canvasCtx = this.canvas[0].getContext("2d");
	this.canvasCtx.canvas.width = this.map.innerWidth();
	this.canvasCtx.canvas.height = this.map.innerHeight();

	this.editing = false;
	this.loading = false;
	this.autoClosePath = true;
	
	var self = this;
	$(document).mouseup(function(event) {
		if(self.editing){
			$(document).unbind('mousemove');
			self.updateMarkersCoordinates(event);
			//draw canvas polygon on map
			self.canvasToMap();
			self.editingIndex = -1;
			self.divDraggable.attr('draggable', 'true');
			self.editing = false;

			if(typeof self.onChangeHandler === 'function'){
				self.onChangeHandler(event);
			}
		}
	});
};
MarkerPolygon.prototype.canvasToMap = function () {
	var self = this;
	var newPath = [];
	for(var i in this.xyCoords){
		if(! this.xyCoords[i].editable){
			newPath.push(this.xyCoords[i].marker.coordinate);
		}
		this.xyCoords[i].marker.set("visibility", true);
	}
	this.Polygon.set('path', newPath);
	this.Polygon.set("visibility", true);
	setTimeout(function(){self.canvas.css('display', 'none');}, 300);
};
MarkerPolygon.prototype.add = function (vertex) {
	//if(this.xyCoords.length < 6){
		var self = this;

		var coord;		//keeps new vertex as nokia.maps.geo.Coordinate (lat, lng)
		var point;		//keeps new vertex as nokia.maps.util.Point (x, y)
		if(vertex.x && vertex.y){
			coord = this.display.pixelToGeo(vertex.x, vertex.y);
			point = vertex;
		} else if(vertex.lat && vertex.lng){
			coord = new nokia.maps.geo.Coordinate(vertex.lat, vertex.lng);
			point = this.display.geoToPixel(coord);
		} else {
			throw "Invalid format of new Vertex: "+ vertex;
		}

		var markerProps = this.markerProps;
		markerProps.icon = this.createIcon(false);
		markerProps.anchor = {x: 6, y: 6};
		markerProps.draggable = (this.loading) ? false : true;
		markerProps.visibility = (this.loading) ? false : true;

		var marker = new nokia.maps.map.Marker(coord, markerProps);
		
		this.xyCoords.push({ x: point.x, y: point.y, editable: false, marker: marker });
		
		// Add the listener function to the capturing phase of the "drag" event
		marker.addListener("mousedown", (this.clickMarker).bind(this), true);

		//changes on mouse cursor
		marker.addListener("mouseover", function (evt) { self.setCursor((self.editable) ? "pointer" : "default"); });
		marker.addListener("mouseout", function (evt) {	self.setCursor("default"); });

		this.display.objects.add(marker);
		
		if(! this.Polygon){
			this.Polygon = new nokia.maps.map.Polygon([coord], this.lineProps);
			this.display.objects.add(this.Polygon);
		} else{
			this.Polygon.path.add(coord);
			
			//create markers to modify the polygon/line
			if(this.xyCoords.length > 1){
				this.createEditableMarker(this.xyCoords.length-2, this.xyCoords.length-1);
				
				//closes the polygon if it has 5+ markers and it doesn't have any other marker to load
				if(this.xyCoords.length >= 5 && this.autoClosePath){
					this.createEditableMarker(this.xyCoords.length-1, 0);
				}
			}
		}
	//}
};
MarkerPolygon.prototype.drawCanvasPolygon = function(){
	this.canvasCtx.canvas.width = this.canvasCtx.canvas.width;
	
	//draw polygon without the markers
	this.canvasCtx.beginPath();
	for(var i in this.xyCoords){
		if(i === 0){
			this.canvasCtx.moveTo(this.xyCoords[i].x, this.xyCoords[i].y);
		} else{
			if(!this.xyCoords[i].editable){
				this.canvasCtx.lineTo(this.xyCoords[i].x, this.xyCoords[i].y);
			}
		}
	}
	this.canvasCtx.closePath();
	this.canvasCtx.fillStyle = this.lineProps.brush.color;
	this.canvasCtx.fill();
	this.canvasCtx.lineWidth = this.lineProps.pen.lineWidth;
	this.canvasCtx.strokeStyle = this.lineProps.pen.strokeColor;
	this.canvasCtx.stroke();

	//draw markers
	for(i in this.xyCoords){
		this.canvasCtx.moveTo(this.xyCoords[i].x, this.xyCoords[i].y);
		this.canvasCtx.beginPath();
		this.canvasCtx.arc(this.xyCoords[i].x, this.xyCoords[i].y, this.markerRadius, 0,2*Math.PI);
		this.canvasCtx.closePath();
		
		this.canvasCtx.fillStyle = (this.xyCoords[i].editable) ? 'rgba(255,255,255,'+ this.markersAlpha +')' : 'white';
		this.canvasCtx.fill();
		this.canvasCtx.strokeStyle = (this.xyCoords[i].editable) ? 'rgb(127,127,127)' : this.markerProps.brush.strokeColor;
		this.canvasCtx.stroke();
	}
};
MarkerPolygon.prototype.mapToCanvas = function() {
	//console.log("mapToCanvas: ", this, arguments);
	var self = this;
	for(var i in this.xyCoords){
		this.xyCoords[i].marker.set("visibility", false);
	}
	this.Polygon.set("visibility", false);
	setTimeout(function(){self.canvas.css('display', 'block');}, 250);
};
MarkerPolygon.prototype.clickMarker = function (evt) {
	//console.log("MarkerPolygon.clickMarker ", this, arguments);
	if(this.editable){
		var self = this;
		evt.preventDefault();
		this.divDraggable.attr('draggable', 'false');
		
		this.editing = true;

		//update coord(x,y) in case the map moved
		var coordAux;
		for(var i=0; i < this.xyCoords.length; i++){
			coordAux = this.display.geoToPixel( this.xyCoords[i].marker.coordinate );
			this.xyCoords[i].x = coordAux.x;
			this.xyCoords[i].y = coordAux.y;
			if(this.xyCoords[i].marker === evt.target){
				this.editingIndex = i;
				//transform editable Marker into vertex marker
				if(this.xyCoords[this.editingIndex].editable){
					this.xyCoords[this.editingIndex].editable = false;
					if(this.editingIndex+1 === this.xyCoords.length){
						this.createEditableMarker(this.editingIndex-1, this.editingIndex);
						this.createEditableMarker(this.editingIndex+1, 0);
					} else{
						this.createEditableMarker(this.editingIndex-1, this.editingIndex);
						this.createEditableMarker(this.editingIndex+1, this.editingIndex+2);
					}
				}
			}
		}
		this.mapToCanvas();
		$(document).mousemove((this.updateMarkersPositions).bind(this));
	}
};
MarkerPolygon.prototype.updateMarkersPositions = function(e){
	if(this.editingIndex === -1){
		console.error("Error on identifying marker was clicked");
	} else{
		var mainMarker = this.xyCoords[this.editingIndex];
		mainMarker.x = e.pageX - this.map.offset().left;
		mainMarker.y = e.pageY - this.map.offset().top;
		this.xyCoords[this.editingIndex] = mainMarker;

		if(this.xyCoords.length > 1){
			//update the left editable Marker
			var lFixedIndex = (this.xyCoords[this.editingIndex-2]) ? this.editingIndex-2 : this.xyCoords.length-2;
			var lEditIndex = (this.xyCoords[this.editingIndex-1]) ? this.editingIndex-1 : this.xyCoords.length-1;
			var leftMarker = this.xyCoords[lEditIndex];
			leftMarker.x = (mainMarker.x + this.xyCoords[lFixedIndex].x)/2;
			leftMarker.y = (mainMarker.y + this.xyCoords[lFixedIndex].y)/2;
			this.xyCoords[lEditIndex] = leftMarker;
			
			if(this.xyCoords.length > 3){
				//update the right editable Marker
				var rFixedIndex = (this.xyCoords[this.editingIndex+2]) ? this.editingIndex+2 : 0;
				var rEditIndex = (this.xyCoords[this.editingIndex+1]) ? this.editingIndex+1 : 0;
				var rightMarker = this.xyCoords[rEditIndex];
				rightMarker.x = (mainMarker.x + this.xyCoords[rFixedIndex].x)/2;
				rightMarker.y = (mainMarker.y + this.xyCoords[rFixedIndex].y)/2;
				this.xyCoords[rEditIndex] = rightMarker;
			}
		}
		this.drawCanvasPolygon();
	}
};
MarkerPolygon.prototype.updateMarkersCoordinates = function(event){
	//update main Marker (which is being dragged)
	var mainMarker = this.xyCoords[this.editingIndex];
	this.xyCoords[this.editingIndex].marker.coordinate = this.display.pixelToGeo(mainMarker.x, mainMarker.y);
	
	if(this.xyCoords.length > 1){
		//update the left editable Marker
		var lMarkerIndex = (this.xyCoords[this.editingIndex-1]) ? this.editingIndex-1 : this.xyCoords.length-1;
		var leftMarker = this.xyCoords[lMarkerIndex];

		this.xyCoords[lMarkerIndex].marker.coordinate = this.display.pixelToGeo(leftMarker.x, leftMarker.y);
		
		//update the right editable Marker
		if(this.xyCoords.length > 3){
			var rMarkerIndex = (this.xyCoords[this.editingIndex+1]) ? this.editingIndex+1 : 0;
			var rightMarker = this.xyCoords[rMarkerIndex];
			this.xyCoords[rMarkerIndex].marker.coordinate = this.display.pixelToGeo(rightMarker.x, rightMarker.y);
		}
	}
};
MarkerPolygon.prototype.createIcon = function(editable){
	var alpha = (editable) ? this.markersAlpha : '1.0';
	var strokeColor = (editable) ? '#888' : this.markerProps.brush.color;

	//circle: radius 5px, border 1px
	var svg = '<svg width="12" height="12" xmlns="http://www.w3.org/2000/svg" version="1.1">'+
				'<circle cx="6" cy="6" r="'+ this.markerRadius +'" stroke="'+ strokeColor +'" stroke-width="1" fill="white" fill-opacity="'+ alpha +'"/>'+
			  '</svg>';
	var svgParser = new nokia.maps.gfx.SvgParser();

	return new nokia.maps.gfx.GraphicsImage(svgParser.parseSvg(svg));
};
MarkerPolygon.prototype.destroy = function(){
	//var path = this.Polygon.path;
	for(var i=this.xyCoords.length-1; i >= 0; i--){
		this.display.objects.remove(this.xyCoords[i].marker);
		this.xyCoords.splice(i, 0);
	}
	this.xyCoords = [];
	if(this.Polygon){
		this.Polygon.destroy();
		this.Polygon = null;
	}
};
MarkerPolygon.prototype.createEditableMarker = function(index1, index2){
	var self = this;
	var point = {
		x: (this.xyCoords[index1].x + this.xyCoords[index2].x)/2,
		y: (this.xyCoords[index1].y + this.xyCoords[index2].y)/2
	};
	var coord = this.display.pixelToGeo(point.x, point.y);
	
	var markerProps = this.markerProps;
	markerProps.icon = this.createIcon(true);
	markerProps.anchor = {x: 6, y: 6};
	markerProps.draggable = (this.loading) ? false : true;
	markerProps.visibility = (this.loading) ? false : true;

	var marker = new nokia.maps.map.Marker(coord, markerProps);
	//marker.index = index;

	//insert in xyCoords maintaining the path order 
	this.xyCoords.splice((index2 !== 0) ? index2 : this.xyCoords.length, 0, { x: point.x, y: point.y, editable: true, marker: marker});

	// Add the listener function to the capturing phase of the "drag" event
	marker.addListener("mousedown", (this.clickMarker).bind(this), true);

	//changes on mouse cursor
	marker.addListener("mouseover", function (evt) { self.setCursor((self.editable) ? "pointer" : "default"); });
	marker.addListener("mouseout", function (evt) {	self.setCursor("default"); });

	/* Add the marker to the object's collections
	 * so the marker will be rendered onto the map
	 */
	this.display.objects.add(marker);
};
MarkerPolygon.prototype.transformMarker = function(evt){
	//console.log("MarkerPolygon.transformMarker ", this, arguments);

	for(var i = 0; i < this.xyCoords.length; i++){
		if(this.xyCoords[i] === evt.target){
			this.editingIndex = i;
			if(i+1 === this.xyCoords.length){
				this.createEditableMarker(i-1, 0);
			} else {
				this.createEditableMarker(i-1, i+1);
			}
		}
	}
};
// Polygon containsLatLng - method to determine if a latLng is within a polygon
MarkerPolygon.prototype.containsLatLng = function(latLng) {
	var lat, lng;

	//arguments are a pair of lat, lng variables
	if(arguments.length === 2) {
		lat = (typeof arguments[0] === "number") ? arguments[0] : parseFloat(arguments[0]);
		lng = (typeof arguments[0] === "number") ? arguments[1] : parseFloat(arguments[1]);
	} else if (arguments.length === 1) {
		lat = latLng.latitude;
		lng = latLng.longitude;
	} else {
		console.error("Wrong number of inputs in MarkerPolygon.prototype.containsLatLng");
	}

	// Raycast point in polygon method
	var inPoly = false;
	var numPoints = this.xyCoords.length;
	var j = numPoints-1;

	for(var i=0; i < numPoints; i++) { 
		var vertex1 = this.xyCoords[i].marker.coordinate;
		var vertex2 = this.xyCoords[j].marker.coordinate;

		if (vertex1.longitude < lng && vertex2.longitude >= lng || vertex2.longitude < lng && vertex1.longitude >= lng) {
			if (vertex1.latitude + (lng - vertex1.longitude) / (vertex2.longitude - vertex1.longitude) * (vertex2.latitude - vertex1.latitude) < lat) {
				inPoly = !inPoly;
			}
		}

		j = i;
	}	
	return inPoly;
};
MarkerPolygon.prototype.setEditable = function(editable) {
	this.editable = editable;
	for(var i in this.xyCoords) {
		this.xyCoords[i].marker.set({
			'draggable': editable,
			'visibility': editable
		});
	}
};
MarkerPolygon.prototype.exists = function() {
	if(this.xyCoords.length > 0){
		return true;
	} else {
		return false;
	}
};
MarkerPolygon.prototype.closedPolygon = function() {
	if(this.xyCoords.length >= 6){
		return true;
	} else {
		return false;
	}
};
MarkerPolygon.prototype.onChange = function(handler) {
	this.onChangeHandler = handler;
};
MarkerPolygon.prototype.setCursor = function(cursor){
	window.document.body.style.cursor = cursor;
};

/*
 * Returns the markerPolygon in WKT format: "POLYGON((LNG LAT,LNG LAT, ...))"
 */
MarkerPolygon.prototype.getPolygonAsString = function(){
	var polygonStrg = '["((';
	//get all real vertexes (excluding the middle points) => i=i+2
	for(var i = 0; i < this.xyCoords.length; i = i+2){
		polygonStrg += this.xyCoords[i].marker.coordinate.longitude +" "+ this.xyCoords[i].marker.coordinate.latitude +",";
	}
	//include the first point in the end to close the polygon
	polygonStrg += this.xyCoords[0].marker.coordinate.longitude +" "+ this.xyCoords[0].marker.coordinate.latitude +'))"]';
	return polygonStrg;
};

MarkerPolygon.prototype.getPolygonPoints = function(){
	var points = [];
	//get all real vertexes (excluding the middle points) => i=i+2
	for(var i = 0; i < this.xyCoords.length; i = i+2){
		points.push({
			longitude: this.xyCoords[i].marker.coordinate.longitude,
			latitude: this.xyCoords[i].marker.coordinate.latitude
		});
	}
	return points;
};

/*
 * Loads a polygon from an Array of objects {latitude: XX, longitude: YY} and let it on a non-editable state
 * Returns a jQuery Deferred Promise, to execute a code after the complete creation of the polygon, that can be: 
 *		- resolved (if successfully created);
 *		- rejected (in case of an exception)
 */
MarkerPolygon.prototype.loadPolygon = function(points){
	var self = this;
	
	self.loading = true;
	self.autoClosePath = false;
	
	var $def = $.Deferred();
	self.display.addListener('displayready', function(evt){
		try{
			for(var i = 0; i < points.length; i++){
				//alert method 'add' to close polygon
				if(i === points.length-1){
					self.autoClosePath = true;
				}
				//add point
				self.add({lat: points[i].latitude, lng: points[i].longitude});
			}
		} catch(e){
			console.error(e);
			$def.reject();
		} finally{
			self.loading = false;
			$def.resolve();
		}
	});
	return $def.promise();
};