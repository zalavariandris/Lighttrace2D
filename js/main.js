

/*====================
 *         GUI
  ====================*/
var selectionGuiFolder;
var stats;
function initGui(){
	// Dat.GUI
	gui = new dat.GUI();

	var raytraceFolder = gui.addFolder('Raytracer');
	raytraceFolder.add(raytracer, "Sampling", ["uniform", "random"]);
	raytraceFolder.add(raytracer, 'SampleCount', 0, 3600).step(1);
	raytraceFolder.add(raytracer, 'MaxRayLength', 0, 5000);
	raytraceFolder.add(raytracer, 'MaxBounces', 0, 8).step(1);
	raytraceFolder.open();

	var layersFolder = gui.addFolder("Layers");
	for(var layer of PAPER.project.layers){
		layersFolder.add(layer, "visible").name(layer.name ? layer.name : "-layer-");
	}
	layersFolder.open();

	// var animFolder = gui.addFolder("Animation");
	// animFolder.add(window, 'Pendulum');
	// animFolder.add(window, 'PendulumSpeed', 0, 2).name("speed");
	// animFolder.add(window, "PendulumRadius", 0, 1000).name("radius");
	// animFolder.open();

	// Stats
	stats = new Stats();
	stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
	document.body.appendChild( stats.dom );
};

function updateGui(){
	if(selectionGuiFolder){
		gui.removeFolder(selectionGuiFolder);
		selectionGuiFolder = null;
	}
	
	var selection = PAPER.project.selectedItems[0];
	if(selection){
		if(selection.data.material){
			selectionGuiFolder = gui.addFolder("Material");
			selectionGuiFolder.add(selection.data, "material", ["diffuse", "mirror", "transparent"]).onChange(()=>{
				console.log("HELLO")
				reset=true;
			});
			selectionGuiFolder.open();
		}
		if(selection.data.light){
			selectionGuiFolder = gui.addFolder("LightShape");
			selectionGuiFolder.add(selection.data, "light", ["omni", "directional", "laser"]).onChange(()=>{
				console.log("HHHHHHHHHHHEEEEEEEE")
				reset=true;
			});
			selectionGuiFolder.open();
		}
	}
}

// Animation Loop
var Pendulum = false;
var PendulumSpeed = 1.0;
var PendulumRadius = 200;

var raytracerMesh = null;
function raysToGeo(pathRays){
	// Reset and populate attributes
	var positions = [];
	var normals = [];
	var colors = [];
	for ( var ray of pathRays) {
		var A = ray.segments[0].point;
		var B = ray.segments[1].point;
		var N = B.subtract(A).normalize(1);
		if(!A.isNaN() && !B.isNaN()){
			// positions
			positions.push( A.x, A.y, 0 );
			positions.push( B.x, B.y, 0 );

			// normals
			normals.push(N.x, N.y, 0);
			normals.push(N.x, N.y, 0);

			// colors
			colors.push( 1,1,1 );
			colors.push( 1,1,1 );
		}
	}

	// Create buffer geometry
	rayGeometry = new THREE.BufferGeometry();
	rayGeometry.addAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );
	rayGeometry.addAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
	rayGeometry.addAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );

	return rayGeometry;
}

function animate(){
	stats.begin();

	// RAYTRACE
	// update raytracer scene
	raytracer.objects = getDescendantItems(raytracer.sceneLayer);
	raytrace();

	// Render with THREE.js
	if(raytracerMesh)
		contentScene.remove(raytracerMesh);
	var raytracerGeo = raysToGeo(PAPER.project.layers['rays'].children);
	raytracerMesh = new THREE.LineSegments( rayGeometry, rayShaderMaterial );
	contentScene.add( raytracerMesh );
	

	tonerPass.material.uniforms.factor.value=iterationCounter;
	renderPasses();
	iterationCounter++;
	
	//
	stats.end();
	requestAnimationFrame(animate);
}

initRaytracer();
var toolStack = new ToolStack();
initSampleScene();
initGui();
updateGui();
animate();

//
toolStack.attach('activated', function(tool){
	for(var btn of document.querySelectorAll("[data-tool]")){
		if(btn.dataset.tool==tool.name)
			btn.classList.add("active");
		else
			btn.classList.remove("active");
	}
});

for(let btn of document.querySelectorAll("[data-tool]")){
	btn.addEventListener('click', (e)=>{
		console.log(btn.dataset.tool, btn);
		toolStack.activateTool(btn.dataset.tool);
	});
}

toolStack.activateTool('selectAndMoveTool');
