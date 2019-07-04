			var PAPER = {};
			var canvas;
			var MaxBounce = 3;
			var MaxRayLength = 2000;
			var SampleCount = 1200;
			var selectAndMoveTool;
			var raysLayer;
			var sceneGroup;
			var circle, ray;
			var omni;
			var LightColor = [255,255,255];
			var Intensity = 0.3;

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
				parent: sceneGroup,
				data:{ior: 1.33}
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
			var rays;
			raysLayer = new PAPER.Layer({name: "rays"});
			raysLayer.locked = true;

			function reflect(V, N){
				return V.subtract(N.multiply(2*V.dot(N)));
			}

			function refract(V, N, ior=1.333){
				var r  = 1/ior;
				var c = - N.dot(V);
				return V.multiply(r).add( N.multiply(r*c - Math.sqrt( 1-Math.pow(r,2) * (1-Math.pow(c,2) )  )) );
			}

			
			function generateInitialRays(){
				rays = [];
				raysLayer.removeChildren();
				for(var i=0; i<SampleCount; i++){
					var angle = Math.PI*2/SampleCount*i;
					var ray = new PAPER.Path.Line({
						from: omni.position,
						to: omni.position.add(new PAPER.Point(Math.sin(angle)*MaxRayLength, Math.cos(angle)*MaxRayLength)),
						parent: raysLayer,
						strokeColor: [LightColor[0], LightColor[1], LightColor[2],Intensity]
					});
					rays.push(ray);
				}
			}

			function raytrace(){
				var secondaryRays = [];
				for(var i=0; i<rays.length; i++){
					// find ray scene intersections
					var ray = rays[i];
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

						// bounce
						var V0 = ray.segments[1].point.subtract(ray.segments[0].point).normalize();
						var N = intersection.intersection.normal;
						var V1 = refract(V0, N, circle.data.ior).normalize();

						if(!V1.isNaN()){
							new PAPER.Path.Line({
								from: intersection.point,
								to: intersection.point.add( V1.normalize(MaxRayLength) ),
								strokeColor: [LightColor[0], LightColor[1], LightColor[2],Intensity],
								parent: raysLayer
							});
						}
					}
				}

				rays = secondaryRays;
			}

			// Animation Loop
			PAPER.view.onFrame = function (event){
				stats.begin();
				generateInitialRays();
				for(var i=0; i<MaxBounce; i++){
					raytrace();
				}
				stats.end();
			}

			// SETUP GUI
			gui = new dat.GUI();
			gui.add(window, 'SampleCount', 0, 360);
			gui.add(window, 'MaxRayLength', 0, 5000);
			gui.add(window, 'MaxBounce', 0, 8);
			gui.add(window, 'Intensity', 0, 1);
			gui.add(circle.data, 'ior', 0, 5);
			gui.addColor(window, 'LightColor');

			for(var layer of PAPER.project.layers){
				gui.add(layer, "visible").name(layer.name ? layer.name : "-layer-");
			}

			// Add fps statistics
			var stats = new Stats();
			stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
			document.body.appendChild( stats.dom );