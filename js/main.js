			var PAPER = {};
			var canvas;
			var MaxRayLength = 2000;
			var SampleCount = 1200;
			var selectAndMoveTool;
			var raysGroup;
			var sceneGroup;
			var circle, ray;
			var omni;
			var LightColor = [255,255,255];
			var Intensity = 7;

			// SETUP GUI
			gui = new dat.GUI();
			gui.add(window, 'SampleCount', 0, 6000);
			gui.add(window, 'MaxRayLength', 0, 5000);
			gui.add(window, 'Intensity', 0, 50);
			gui.addColor(window, 'LightColor');

			// setup PAPER
			paper.install(PAPER);
			canvas = document.getElementById('myCanvas');
			paper.setup(canvas);

			function resize(){
				PAPER.view.setViewSize(window.innerWidth, window.innerHeight);
			}
			window.onresize = resize;
			resize();

			// Creare Scene with glass Circle
			sceneGroup = new PAPER.Group();
			circle = new PAPER.Path.Circle({
				center: PAPER.view.center,
				radius: 100,
				strokeColor: 'white',
				fillColor: "black",
				parent: sceneGroup
			});

			// The Lightsource
			omni = new PAPER.Path.Circle({
				center: new PAPER.Point(100,100),
				radius: 10,
				fillColor: 'orange'

			});

			// Select and Move tool
			selectAndMoveTool = new PAPER.Tool();
			selectAndMoveTool.onMouseDown = function(event){
				var hit = PAPER.project.hitTest(event.point);
				PAPER.project.deselectAll();
				if(hit){
					hit.item.selected = true;
				}else{
					omni.position = event.point;
					omni.selected = true;
				}
			}

			selectAndMoveTool.onMouseDrag = function(event) {
				if(PAPER.project.selectedItems.length>0){
					for(var i=0; i<PAPER.project.selectedItems.length; i++){
						var item = PAPER.project.selectedItems[i];
						item.position = item.position.add(event.delta);
					}
				}
			}

			// Raytrace
			raysGroup = new PAPER.Group();
			raysGroup.locked = true;
			function reflect(V, N){
				return V.subtract(N.multiply(2*V.dot(N)));
			}

			function refract(V, N, ior=1.333){
				var r  = ior;
				var c = N.dot(V);
				return V.multiply(r).add( N.multiply(r*c - Math.sqrt( 1-Math.pow(r,2) * (1-Math.pow(c,2) )  )) );
			}

			function generateInitialRays(){
				var rays =  {origins: [], directions: []};
				for(var i=0; i<SampleCount; i++){
					rays.origins.push(omni.position);
					var angle = Math.PI*2/SampleCount*i;
					rays.directions.push(new PAPER.Point(Math.sin(angle)*MaxRayLength, Math.cos(angle)*MaxRayLength));
				}
				return rays;
			}

			function raytrace(rays){
				var secondaryRays = {origins: [], directions: []};
				for(var i=0; i<rays.origins.length; i++)
				{
					// add light ray
					var ray = new PAPER.Path({parent: raysGroup});
					ray.strokeColor = [LightColor[0], LightColor[1], LightColor[2], Intensity*Intensity/SampleCount];
					ray.strokeWidth = 1.5;
					ray.add(rays.origins[i], rays.origins[i].add(rays.directions[i]));

					// find ray scene intersections
					var intersections = ray.getCrossings(circle);

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
						// adjust ray length
						ray.segments[1].point = intersection.point;

						// reflect
						var V0 = ray.segments[1].point.subtract(ray.segments[0].point).normalize();
						var N = intersection.intersection.normal;

						var V1;

						V1 = refract(V0, N).normalize();

						// if(V1.
						if(!V1.isNaN()){
							secondaryRays.origins.push(intersection.point); //!!! FIX, secondary rays starts on the surface an immidiatelly collide with it.
							secondaryRays.directions.push(V1.normalize(MaxRayLength));
						}
					}
				}

				return secondaryRays;
				// for(var i=0; i<rays.origins.length; i++){
				// 	var ray = new PAPER.Path({parent: raysGroup});
				// 	ray.strokeColor = LightColor;
				// 	ray.strokeWidth = 1.5;
				// 	ray.add(rays.origins[i], rays.origins[i].add(rays.directions[i]));
				// }

			}

			// Animation Loop
			PAPER.view.onFrame = function (event){
				var rays = [];
				stats.begin();
				raysGroup.removeChildren();
				rays = generateInitialRays();
				rays = raytrace(rays);
				rays = raytrace(rays);
				rays = raytrace(rays);
				stats.end();
			}

			// Add fps statistics
			var stats = new Stats();
			stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
			document.body.appendChild( stats.dom );