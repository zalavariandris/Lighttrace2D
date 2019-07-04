			var PAPER = {};
			var canvas;
			var MaxRayLength = 2000;
			var SampleCount = 300;
			var selectAndMoveTool;
			var raysGroup;
			var sceneGroup;
			var vizGroup;
			var circle, ray;
			var omni;
			var LightColor = 'rgba(255,255,255,0.1)';

			paper.install(PAPER);
			canvas = document.getElementById('myCanvas');
			paper.setup(canvas);

			window.onresize = function(event){
				PAPER.view.setViewSize(window.innerWidth, window.innerHeight);
			}
			PAPER.view.setViewSize(window.innerWidth, window.innerHeight);

			sceneGroup = new PAPER.Group();
			circle = new PAPER.Path.Circle({
				center: PAPER.view.center,
				radius: 160,
				strokeColor: 'white',
				fillColor: "black",
				parent: sceneGroup
			});

			// box = new PAPER.Path.Rectangle(new PAPER.Point(150, 150), new PAPER.Point(500, 500));
			// box.fillColor = 'black';
			// box.strokeColor = 'white';
			// box.parent = sceneGroup;


			omni = new PAPER.Path.Circle({
				center: new PAPER.Point(100,100),
				radius: 10,
				fillColor: 'orange'

			});

			PAPER.view.draw();

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

			vizGroup = new PAPER.Group();
			function vizIntersection(intersections){
				vizGroup.removeChildren();
				for (var i = 0; i < intersections.length; i++) {
					new PAPER.Path.Circle({
						center: intersections[i].point,
						radius: 2,
						fillColor: "cyan",
						parent: vizGroup
					});
				}
			}

			raysGroup = new PAPER.Group();
			raysGroup.locked = true;
			var allIntersections;

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

			function raytrace(rays)
			{
				allIntersections = [];
				var secondaryRays = {origins: [], directions: []};
				for(var i=0; i<rays.origins.length; i++)
				{
					// add light ray
					var ray = new PAPER.Path({parent: raysGroup});
					ray.strokeColor = LightColor;
					ray.strokeWidth = 1.5;
					ray.add(rays.origins[i], rays.origins[i].add(rays.directions[i]));

					// find ray scene intersections
					var intersections = ray.getIntersections(circle);

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

						// gather all rays intersections
						allIntersections.push(intersection);


						// reflect
						var V0 = ray.segments[1].point.subtract(ray.segments[0].point).normalize();
						var N = intersection.intersection.normal;

						var V1;

						V1 = refract(V0, N).normalize();

						// if(V1.
						if(!V1.isNaN()){
							secondaryRays.origins.push(intersection.point.add(V1.normalize())); //!!! FIX, secondary rays starts on the surface an immidiatelly collide with it.
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


				//vizIntersection(allIntersections);
			}

			var stats = new Stats();
			stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
			document.body.appendChild( stats.dom );

			var rays = [];
			PAPER.view.onFrame = function (event){
				stats.begin();
				raysGroup.removeChildren();
				rays = generateInitialRays();
				rays = raytrace(rays);
				rays = raytrace(rays);
				rays = raytrace(rays);

				stats.end();
			}