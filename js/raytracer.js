// Raytracer
var PAPER = {};
var raytracer = {
	MaxBounces: 3,
	MaxRayLength: 2000,
	SampleCount: 60,
	Sampling: "random",

	raysLayer: null,
	sceneLayer: null,
	debugLayer: null,
	lightLayer: null,

	objects: [],
	lights: []
}

function initRaytracer(){
	// init PAPERJS
	paper.install(PAPER);
	paper.setup(document.getElementById('paper'));

	function resize(){
		PAPER.view.setViewSize(window.innerWidth, window.innerHeight);
	}
	window.addEventListener('resize', resize);
	resize();

	// setup Layers
	raytracer.sceneLayer = new PAPER.Layer({
		name: "scene",
		strokeColor: 'rgba(128, 128, 128, 0.7)',
		strokeWidth: 3,
		fillColor: "rgba(0,0,0,0.001)"
	});

	raytracer.lightLayer = new PAPER.Layer({
		name: "lights",
		locked: false
	});

	raytracer.raysLayer = new PAPER.Layer({
		name: "rays",
		locked: true,
		visible: false
	});

	raytracer.debugLayer = new PAPER.Layer({
		name: "debug",
		locked: true,
		visible: false
	});

	raytracer.objects = getDescendantItems(PAPER.project.layers['scene']);
	raytracer.lights = [];
}

function initSampleScene(){
	raytracer.lights = [];
	var omni = new PAPER.Path.Circle({
		center: new PAPER.Point(100,PAPER.view.center.y),
		radius: 30,
		fillColor: "rgba(0,0,0,0.001)",
		strokeColor: 'rgba(255, 150, 0, 1)',
		parent: PAPER.project.layers['lights'],
		data: {
			light: 'omni' // omni | laser | spot | directional | object
		}
	});
	raytracer.lights.push(omni);

	new PAPER.Path.Circle({
		center: PAPER.view.center,
		radius: 150,
		parent: PAPER.project.layers['scene'],
		fillColor: "rgba(0,0,0,0.001)",
		strokeColor: 'rgba(128, 128, 128, 0.7)',
		data: {
			material: 'transparent'
		},
		selected: true
	});

	new PAPER.Path.Rectangle({
		from: new PAPER.Point(PAPER.view.size.width*1/9, PAPER.view.size.height*7/9),
		to: new PAPER.Point(PAPER.view.size.width*8/9, PAPER.view.size.height*9/9),
		parent: PAPER.project.layers['scene'],
		fillColor: "rgba(0,0,0,0.001)",
		strokeColor: 'rgba(128, 128, 128, 0.7)',
		data: {
			'material': "diffuse"
		}
	});
}

/*
 * RAYTRACE
 */

function getDescendantItems(root) {
	var descendants = [];
	var stack = [root];

	while(stack.length>0){
		var current = stack.pop();

		if(current.children){
			for(var child of current.children){
				stack.push(child);
				descendants.push(child);
			}
		}
	}

	return descendants;
}

function createRay(origin, direction, intensity=1.0){
	var rayColor = new PAPER.Color(255, 255, 0.5, intensity/raytracer.SampleCount);
	return new PAPER.Path.Line({
		from: origin,
		to: origin.add(direction),
		parent: raytracer.raysLayer,
		strokeColor: 'rgba(255, 255, 128, 1)',
		data: {
			intersection: null
		}
	});
}

function sampleMirror(V, N){
	return V.subtract(N.multiply(2*V.dot(N)));
}

function sampleTransparent(V, N, ior=1.440){
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

function sampleDiffuse(V, N){
	var c = - N.dot(V);
    var xi = Math.random();
    var sinThetaI = 2.0*xi - 1.0;
    var cosThetaI = Math.sqrt(1.0 - sinThetaI*sinThetaI);
    var V1 = new PAPER.Point(cosThetaI, sinThetaI).rotate(N.angle);

    if(c>0){
    	return V1;
    }else{
    	return V1.negate();
    }
}

function raytrace(){
	raytracer.raysLayer.removeChildren();
	raytracer.debugLayer.removeChildren();

	// generate initial rays
	var rays = [];
	for(var light of raytracer.lights){
		if(light.data.light=="omni"){
			for(var i=0; i<raytracer.SampleCount; i++){
				var rayAngle;
				if(raytracer.Sampling=="uniform"){
					rayAngle = Math.PI*2/raytracer.SampleCount*i;
				} else if(raytracer.Sampling=="random"){
					rayAngle = Math.PI*2*Math.random();// random sampling
				}	
				var dir = new PAPER.Point(Math.sin(rayAngle)*raytracer.MaxRayLength, Math.cos(rayAngle)*raytracer.MaxRayLength);
				var ray = createRay(light.position, dir);
				rays.push(ray);
			}
		}
		else if(light.data.light=="laser"){
			for(var i=0; i<raytracer.SampleCount; i++){
				var rayDirection = light.segments[2].point.subtract(light.segments[0].point).normalize(raytracer.MaxRayLength);
				var ray = createRay(light.position, rayDirection);
				rays.push(ray);
			}
		}else if(light.data.light=="directional"){
			for(var i=0;i<raytracer.SampleCount; i++){
				var rayOrigin;
				var lightWidth = 100;
				var rayDirection = light.segments[2].point.subtract(light.segments[0].point).normalize(raytracer.MaxRayLength);
				var rayTangent = new PAPER.Point(-rayDirection.y, rayDirection.x).normalize();
				if(raytracer.Sampling=="uniform"){
					rayOrigin = light.position.add(rayTangent.normalize(lightWidth).multiply(i/raytracer.SampleCount-0.5));
				}else if(raytracer.Sampling=="random"){
					rayOrigin = light.position.add(rayTangent.normalize(lightWidth).multiply(Math.random()-0.5));
				}
				
				var ray = createRay(
					rayOrigin, 
					rayDirection
					);
				rays.push(ray);
			}
		}
	}

	// trace lightrays
	for(var bounces=0; bounces < raytracer.MaxBounces+1; bounces++){
		// Collide rays with scene
		for(var ray of rays){
			// gather all ray, scene intersections
			var intersections = [];
			for(var item of raytracer.objects){
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
				var angle = ray.data.intersection.intersection.normal.angle;

				var arrowHead = new PAPER.Path();
				var headSize = 8;
				arrowHead.add(new PAPER.Point(-headSize/2, 0), new PAPER.Point(0, headSize), new PAPER.Point(headSize/2, 0));
				arrowHead.parent = raytracer.debugLayer;
				arrowHead.position = position.add(normal.multiply(15));
				arrowHead.fillColor = "lime";
				arrowHead.rotation = angle;

				var arrowBody = new PAPER.Path.Line(position, position.add(normal.multiply(10)));
				arrowBody.strokeColor = "lime";
			}
		}

		// Spawn bounce rays
		if(bounces<raytracer.MaxBounces){
			var secondaryRays = [];
			for(var ray of rays){
				if(ray.data.intersection){
					// bounce
					var V0 = ray.segments[1].point.subtract(ray.segments[0].point).normalize();
					// var V0 = ray.data.intersection.normal;
					var N = ray.data.intersection.intersection.normal;
					
					// if collision happens inside the object, invert Normal
					// if(N.dot(V0)>0) N = N.multiply(-1);

					// var V1 = refract(V0, N, IOR).normalize();
					var material = ray.data.intersection.intersection.path.data.material;
					// var V1 = sampleBSDF(V0, N, material);
					var V1;
					if(material == "transparent"){
						V1 = sampleTransparent(V0, N);
					} else if(material == "mirror"){
						V1 = sampleMirror(V0, N);
					} else{
						V1 = sampleDiffuse(V0, N);
					}

					if(!V1.isNaN()){
						var bounce = createRay(ray.data.intersection.point, V1.normalize(raytracer.MaxRayLength));
						secondaryRays.push(bounce);
					}
				}
			}
			rays = secondaryRays;
		}
	}
}