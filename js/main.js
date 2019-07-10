var PAPER = {};
var canvas;
var MaxBounces = 5;
var MaxRayLength = 2000;
var SampleCount = 320;
var selectAndMoveTool;
var circleTool;
var rectangleTool;
var raysLayer;
var sceneLayer;
var circle, ray;
var omni;
var RayColor = [255,255,128];
var Intensity = 7;
var Pendulum = false;
var PendulumSpeed = 1.0;
var PendulumRadius = 200;
var IOR = 3;
var GlassColor = "rgba(0,0,0,0.001)";

var Sampling = "random";


// setup PAPER
function initPAPER(){
	canvas = document.getElementById('paper');
	paper.install(PAPER);
	paper.setup(canvas);

	function resize(){
		PAPER.view.setViewSize(window.innerWidth, window.innerHeight);
	}
	window.addEventListener('resize', resize);
	resize();
}

initPAPER();

function setupLayers(){
	// setup layers
	sceneLayer = new PAPER.Layer({
		name: "scene",
		strokeColor: 'rgba(128, 128, 128, 0.7)',
		strokeWidth: 3,
		fillColor: GlassColor
	});

	lightLayer = new PAPER.Layer({
		name: "lights"
	});

	raysLayer = new PAPER.Layer({
		name: "rays",
		locked: true,
		visible: false
	});

	debugLayer = new PAPER.Layer({
		name: "debug",
		locked: true,
		visible: false
	});
}
setupLayers();

var lights;
function initDefaultScene(){
	lights = [];
	omni = new PAPER.Path.Circle({
		center: new PAPER.Point(100,PAPER.view.center.y),
		radius: 30,
		strokeColor: 'rgba(255, 150, 0, 1)',
		parent: PAPER.project.layers['lights'],
		data: {
			type: "omni"
		}
	});
	lights.push(omni);
	new PAPER.Path.Circle({
		center: PAPER.view.center,
		radius: 150,
		parent: PAPER.project.layers['scene'],
		fillColor: GlassColor,
		strokeColor: 'rgba(128, 128, 128, 0.7)'
	});
}
initDefaultScene();

function initTools(){
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
				fillColor: GlassColor,
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
				fillColor: GlassColor,
				strokeWidth: 3,
				parent: sceneLayer
			});


			var R = 1/2.2;
			if(event.downPoint.x<event.point.x){
				this.lens.add(event.point.x*R+event.downPoint.x*(1-R), event.downPoint.y);
				this.lens.lineTo( event.point.x*(1-R)+event.downPoint.x*R, event.downPoint.y);

				this.lens.arcTo(
					new PAPER.Point( event.point.x, (event.point.y+event.downPoint.y)/2 ),
					new PAPER.Point( event.point.x*(1-R)+event.downPoint.x*R, event.point.y )
				)
				this.lens.lineTo( event.point.x*R+event.downPoint.x*(1-R), event.point.y);
				this.lens.arcTo(
					new PAPER.Point( event.downPoint.x, (event.point.y+event.downPoint.y)/2 ),
					new PAPER.Point( event.point.x*R+event.downPoint.x*(1-R), event.downPoint.y )
				)
			}else{
				this.lens.add(event.point.x, event.downPoint.y);
				this.lens.lineTo(event.downPoint.x, event.downPoint.y);

				this.lens.arcTo(
					new PAPER.Point( event.point.x*R+event.downPoint.x*(1-R), (event.point.y+event.downPoint.y)/2 ),
					new PAPER.Point( event.downPoint.x, event.point.y )
				)
				this.lens.lineTo(event.point);
				this.lens.arcTo(
					new PAPER.Point( event.point.x*(1-R)+event.downPoint.x*R, (event.point.y+event.downPoint.y)/2 ),
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
}


initTools();

/*
 * RAYTRACE
 */
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

function getRayColor(){
	return new PAPER.Color(RayColor[0]/255, RayColor[1]/255, RayColor[2]/255, Intensity/SampleCount);

	// addative blend mode is too slow for 2d canvas
	return new PAPER.Color({
		hue: 360*Math.random(),
		saturation: 1,
		brightness: 1,
		alpha: Intensity
	});
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

function createRay(origin, direction){
	return new PAPER.Path.Line({
		from: origin,
		to: origin.add(direction),
		parent: raysLayer,
		strokeColor: getRayColor(),
		data: {
			intersection: null
		}
	});
}

	function raytrace(){
	raysLayer.removeChildren();
	debugLayer.removeChildren();
	// generate initial rays
	var rays = [];
	for(var light of lights){
		for(var i=0; i<SampleCount; i++){
			if(light.data.type=="omni"){
				var angle;
				if(Sampling=="uniform"){
					angle = Math.PI*2/SampleCount*i;
				}
				if(Sampling=="random"){
					angle = Math.PI*2*Math.random();// random sampling
				}	
				var dir = new PAPER.Point(Math.sin(angle)*MaxRayLength, Math.cos(angle)*MaxRayLength);
				var ray = createRay(omni.position, dir);
				rays.push(ray);
			}
			if(light.type=="directional"){

			}
		}
	}

	// trace lightrays
	for(var bounces=0; bounces < MaxBounces+1; bounces++){
		// Collide rays with scene
		for(var ray of rays){
			// gather all ray, scene intersections
			var intersections = [];
			for(var item of getDescendants([PAPER.project.layers['scene']])){
				if(item instanceof PAPER.Path){
					for(var intersection of ray.getCrossings(item)){
						intersections.push(intersection);
					}
				}
			}

			// get closest intersection of current ray
			var origin = ray.segments[0].point;
			var distance = Infinity;
			var closestIntersection = null;
			for(var intersection of intersections){
				var d = origin.getDistance(intersection.point)
				if(d<distance){
					distance = d;
					closestIntersection = intersection;
				}
			}

			if(closestIntersection){
				ray.data.intersection = closestIntersection;
			}
		}

		// Terminate rays at collision
		for(var ray of rays){
			if(ray.data.intersection){
				ray.segments[1].point = ray.data.intersection.point;
			}
		}

		// Debug intersection points
		for(var ray of rays){
			if(ray.data.intersection){
				var normal = ray.data.intersection.intersection.normal.normalize()
				var position = ray.data.intersection.point;
				var angle = ray.data.intersection.intersection.normal.angle-90;

				var arrowHead = new PAPER.Path();
				var headSize = 8;
				arrowHead.add(new PAPER.Point(-headSize/2, 0), new PAPER.Point(0, headSize), new PAPER.Point(headSize/2, 0));
				arrowHead.parent = debugLayer;
				arrowHead.position = position.add(normal.multiply(15));
				arrowHead.fillColor = "lime";
				arrowHead.rotation = angle;

				var arrowBody = new PAPER.Path.Line(position, position.add(normal.multiply(10)));
				arrowBody.strokeColor = "lime";
			}
		}

		// Spawn bounce rays
		if(bounces<MaxBounces){
			var secondaryRays = [];
			for(var ray of rays){
				if(ray.data.intersection){
					// bounce
					var V0 = ray.segments[1].point.subtract(ray.segments[0].point).normalize();
					var N = ray.data.intersection.intersection.normal;
					var V1 = refract(V0, N, IOR).normalize();

					if(!V1.isNaN()){
						// create ray with origin, direction
						// var bounce = new PAPER.Path.Line({
						// 	from: ray.data.intersection.point,
						// 	to: ray.data.intersection.point.add( V1.normalize(MaxRayLength) ),
						// 	strokeColor: getLightColor(),
						// 	parent: raysLayer
						// });
						var bounce = createRay(ray.data.intersection.point, V1.normalize(MaxRayLength));
						secondaryRays.push(bounce);
					}
				}
			}
			rays = secondaryRays;
		}
	}
}

// SETUP GUI
(function initGui(){
	gui = new dat.GUI();

	var raytraceFolder = gui.addFolder('Raytrace');
	raytraceFolder.add(window, "Sampling", ["uniform", "random"]);
	raytraceFolder.add(window, 'SampleCount', 0, 3600).step(1);
	raytraceFolder.add(window, 'MaxRayLength', 0, 5000);
	raytraceFolder.add(window, 'MaxBounces', 0, 8).step(1);
	raytraceFolder.open();
	var lightFolder = gui.addFolder("Light");
	lightFolder.add(window, 'Intensity', 0, 300);
	lightFolder.addColor(window, 'RayColor');
	lightFolder.open();
	var materialFolder = gui.addFolder("Material");
	materialFolder.add(window, 'IOR', 0, 5);
	materialFolder.open();

	var layersFolder = gui.addFolder("Layers");
	for(var layer of PAPER.project.layers){
		layersFolder.add(layer, "visible").name(layer.name ? layer.name : "-layer-");
	}
	layersFolder.open();

	var animFolder = gui.addFolder("Animation");
	animFolder.add(window, 'Pendulum');
	animFolder.add(window, 'PendulumSpeed', 0, 2).name("speed");
	animFolder.add(window, "PendulumRadius", 0, 1000).name("radius");
	animFolder.open();
}());

// Add fps statistics
var stats;
(function(){
	stats = new Stats();
	stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
	document.body.appendChild( stats.dom );
})();
// initStats();

// Animation Loop
PAPER.view.onFrame = function (event){
	stats.begin();

	// RAYTRACE
	raytrace();
	
	if(Pendulum){
		var pivot = PAPER.view.center;
		omni.position.x = Math.cos(new Date().getTime()*0.001*PendulumSpeed)*PendulumRadius+pivot.x;
		omni.position.y = Math.sin(new Date().getTime()*0.001*PendulumSpeed)*PendulumRadius+pivot.y;
	}

	stats.end();
}


