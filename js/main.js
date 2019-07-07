var PAPER = {};
var canvas;
var MaxBounce = 5;
var MaxRayLength = 2000;
var SampleCount = 60;
var selectAndMoveTool;
var circleTool;
var rectangleTool;
var raysLayer;
var sceneLayer;
var circle, ray;
var omni;
var LightColor = [255,255,128];
var Intensity = 100;
var Pendulum = false;
var IOR = 1.333;

// setup PAPER
canvas = document.getElementById('myCanvas');
paper.install(PAPER);
paper.setup(canvas);

function resize(){
	PAPER.view.setViewSize(window.innerWidth, window.innerHeight);
}
window.onresize = resize;
resize();

// setup layers
sceneLayer = new PAPER.Layer({
	name: "scene",
	strokeColor: 'rgba(128, 128, 128, 0.7)',
	strokeWidth: 3,
	fillColor: "rgba(0,0,0,0.3)"
});

lightLayer = new PAPER.Layer({
	name: "lights"
});

// Create default scene
omni = new PAPER.Path.Circle({
	center: new PAPER.Point(100,PAPER.view.center.y),
	radius: 10,
	fillColor: 'orange',
	parent: PAPER.project.layers['lights']
});

new PAPER.Path.Circle({
	center: PAPER.view.center,
	radius: 150,
	parent: PAPER.project.layers['scene'],
	fillColor: "rgba(0,0,0,0.3)",
	strokeColor: 'rgba(128, 128, 128, 0.7)'
});

/*
 * TOOLS
 */
selectAndMoveTool = new PAPER.Tool({
	onMouseDown: function(event){
		var hit = PAPER.project.hitTest(event.point);
		PAPER.project.deselectAll();
		if(hit){
			hit.item.selected = true;
		}else{
			omni.position = event.point;
			omni.selected = true;
		}
	},
	onMouseDrag: function(event) {
		for(var item of PAPER.project.selectedItems){
			if(!item.locked)
				item.position = item.position.add(event.delta);
			if(item.data.generator)
				item.data.generator.position = item.data.generator.position.add(event.delta);
		}
	},
	onKeyDown: function(event){
		if(event.event.srcElement.tagName != "INPUT"){ //!!! temporary fix for bubbling keyboard events
			if(event.key == "backspace"){
				for(var item of PAPER.project.selectedItems){
					item.remove();
				}
			}
		}
	}
});

circleTool = new PAPER.Tool({
	onMouseDown: function(event){
		PAPER.project.deselectAll();
	},
	onMouseDrag: function(event){
		if(this.circle)
			this.circle.remove();
		var scale = event.downPoint.getDistance(event.point);
		this.circle = new PAPER.Path.Circle({
			center: event.downPoint,
			radius: scale,
			strokeColor: 'rgba(128, 128, 128, 0.7)',
			fillColor: "rgba(0,0,0,0.3)",
			strokeWidth: 3,
			parent: sceneLayer
		});
		this.circle.selected = true;
	},
	onMouseUp: function(event){
		this.circle = null;
		selectAndMoveTool.activate();
		document.querySelector("button[title='Select and move'").focus();
	}
});

lensTool = new PAPER.Tool({
	onMouseDown: function(event){
		PAPER.project.deselectAll();
	},
	onMouseDrag: function(event){
		if(this.lens)
			this.lens.remove();

		var size = event.downPoint.subtract(event.point);

		this.lens = new PAPER.Path({
			strokeColor: 'rgba(128, 128, 128, 0.7)',
			fillColor: "rgba(0,0,0,0.3)",
			strokeWidth: 3,
			parent: sceneLayer
		});


		if(event.downPoint.x<event.point.x){
			this.lens.add((event.point.x+event.downPoint.x*2)/3, event.downPoint.y);
			this.lens.lineTo((event.point.x*2+event.downPoint.x)/3, event.downPoint.y);

			this.lens.arcTo(
				new PAPER.Point( event.point.x, (event.point.y+event.downPoint.y)/2 ),
				new PAPER.Point( (event.point.x*2+event.downPoint.x)/3, event.point.y )
			)
			this.lens.lineTo((event.point.x+event.downPoint.x*2)/3, event.point.y);
			this.lens.arcTo(
				new PAPER.Point( event.downPoint.x, (event.point.y+event.downPoint.y)/2 ),
				new PAPER.Point( (event.point.x+event.downPoint.x*2)/3, event.downPoint.y )
			)
		}else{
			this.lens.add(event.point.x, event.downPoint.y);
			this.lens.lineTo(event.downPoint.x, event.downPoint.y);

			this.lens.arcTo(
				new PAPER.Point( (event.point.x+event.downPoint.x*2)/3, (event.point.y+event.downPoint.y)/2 ),
				new PAPER.Point( event.downPoint.x, event.point.y )
			)
			this.lens.lineTo(event.point);
			this.lens.arcTo(
				new PAPER.Point( (event.point.x*2+event.downPoint.x)/3, (event.point.y+event.downPoint.y)/2 ),
				new PAPER.Point( event.point.x, event.downPoint.y )
			)
		}
		this.lens.selected = true;
	},
	onMouseUp: function(event){
		this.lens = null;
		selectAndMoveTool.activate();
		document.querySelector("button[title='Select and move'").focus();
	}
});

// focus default selectAndMove tool
document.querySelector("button[title='Select and move'").focus();

/*
 * RAYTRACE
 */
var rays;
raysLayer = new PAPER.Layer({name: "rays"});
raysLayer.locked = true;
debugLayer = new PAPER.Layer({name: "debug"});
debugLayer.locked = true;
debugLayer.visible = false;

function reflect(V, N){
	return V.subtract(N.multiply(2*V.dot(N)));
}

function refract(V, N, ior=1.333){
	var c = - N.dot(V);
	if(c>0){
		// collide from outside
		var r  = 1/ior;
		return V.multiply(r).add( N.multiply(r*c - Math.sqrt( 1-Math.pow(r,2) * (1-Math.pow(c,2) )  )) );
	}else{
		// collide from inside
		var r  = ior/1;
		return V.multiply(r).add( N.multiply(r*c + Math.sqrt( 1-Math.pow(r,2) * (1-Math.pow(c,2) )  )) );
	}
}

function getLightColor(){
	return new PAPER.Color(LightColor[0]/255, LightColor[1]/255, LightColor[2]/255, Intensity/SampleCount);

	// addative blend mode is too slow for 2d canvas
	return new PAPER.Color({
		hue: 360*Math.random(),
		saturation: 1,
		brightness: 1,
		alpha: Intensity
	});
}

function generateInitialRays(){
	rays = [];
	for(var i=0; i<SampleCount; i++){
		var angle = Math.PI*2/SampleCount*i;
		var ray = new PAPER.Path.Line({
			from: omni.position,
			to: omni.position.add(new PAPER.Point(Math.sin(angle)*MaxRayLength, Math.cos(angle)*MaxRayLength)),
			parent: raysLayer,
			strokeColor: getLightColor()
		});
		rays.push(ray);
	}
}

function getDescendants(items, l=[]){
	for(var item of items){
		l.push(item);
		if(item.children){
			getDescendants(item.children, l);
		}
	}
	return l;
}

function raytrace(terminate=false){
	// collide rays with scene
	for(var i=0; i<rays.length; i++){
		// find ray scene intersections
		var ray = rays[i];
		var intersections = [];

		// for(var o of PAPER.project.layers['scene'].getItems()){
		for(var o of getDescendants([PAPER.project.layers['scene']])){
			if(o instanceof PAPER.Path){
				for(var intersection of ray.getCrossings(o)){
					intersections.push(intersection);
				}
			}
		}

		// get closest intersection of current ray
		var origin = ray.segments[0].point;
		var distance = Infinity;
		var intersection = null;
		for (var j = 0; j < intersections.length; j++) {
			var d = origin.getDistance(intersections[j].point)
			if(d<distance){
				distance = d;
				intersection = intersections[j];
			}
		}

		if(intersection){
			ray.data.intersection = intersection;
		}
	}

	// terminate rays at collision
	for(var ray of rays){
		if(ray.data.intersection){
			ray.segments[1].point = ray.data.intersection.point;
		}
	}

	// viz intersection points
	for(var ray of rays){
		if(ray.data.intersection){
			// new PAPER.Path.Circle({
			// 	center: ray.data.intersection.point,
			// 	fillColor: "red",
			// 	radius: 2,
			// 	parent: debugLayer
			// });

			var triangle = new PAPER.Path();
			triangle.add(new PAPER.Point(-2, 0), new PAPER.Point(0, 10), new PAPER.Point(2, 0));
			triangle.parent = debugLayer;
			triangle.position = ray.data.intersection.point.add(ray.data.intersection.intersection.normal.normalize(5));
			triangle.fillColor = "cyan";
			triangle.rotation = ray.data.intersection.intersection.normal.angle-90;
		}
	}

	if(!terminate){
		// Spawn bounce rays
		var secondaryRays = [];
		for(var i=0; i<rays.length; i++){
			var ray = rays[i];
			if(ray.data.intersection){
				// bounce
				var V0 = ray.segments[1].point.subtract(ray.segments[0].point).normalize();
				var N = ray.data.intersection.intersection.normal;
				var V1 = refract(V0, N, IOR).normalize();

				if(!V1.isNaN()){
					var bounce = new PAPER.Path.Line({
						from: ray.data.intersection.point,
						to: ray.data.intersection.point.add( V1.normalize(MaxRayLength) ),
						strokeColor: getLightColor(),
						parent: raysLayer
					});
					secondaryRays.push(bounce);
				}
			}
		}
		rays = secondaryRays;
	}
}

// SETUP GUI
var setupGUI = (function f(){
	gui = new dat.GUI();
	var raytraceFolder = gui.addFolder('Raytrace');
	raytraceFolder.add(window, 'SampleCount', 0, 3600).step(1);
	raytraceFolder.add(window, 'MaxRayLength', 0, 5000);
	raytraceFolder.add(window, 'MaxBounce', 0, 8).step(1);
	raytraceFolder.open();
	var lightFolder = gui.addFolder("Light");
	lightFolder.add(window, 'Intensity', 0, 300);
	lightFolder.addColor(window, 'LightColor');
	lightFolder.open();
	var materialFolder = gui.addFolder("Material");
	materialFolder.add(window, 'IOR', 0, 5);
	materialFolder.open();

	var layersFolder = gui.addFolder("Layers");
	for(var layer of PAPER.project.layers){
		layersFolder		.add(layer, "visible").name(layer.name ? layer.name : "-layer-");
	}
	layersFolder.open();

	var animFolder = gui.addFolder("Animation");
	animFolder.add(window, 'Pendulum');
	animFolder.open();
})();

// Add fps statistics
var stats = new Stats();
stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild( stats.dom );

// Animation Loop
PAPER.view.onFrame = function (event){
	stats.begin();
	raysLayer.removeChildren();
	debugLayer.removeChildren();
	generateInitialRays();
	for(var i=0; i<MaxBounce; i++){
		raytrace();
	}
	raytrace(true);
	

	if(Pendulum){
		omni.position.x = Math.sin(new Date().getTime()*0.001*0.3)*window.innerWidth/2+window.innerWidth/2;
	}

	stats.end();
}


