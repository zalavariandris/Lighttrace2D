
var rayVertexShader = `
	varying vec3 vColor;
	varying vec3 vN;
	varying float vBias;

	float rasterizationBias(float x, float y){
		return sqrt( x*x + y*y ) / max( abs(x), abs(y) );
	}

    void main() {
      // rasterization bias
      vBias = rasterizationBias(normal.x, normal.y);

	  vColor = color;

      vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * modelViewPosition;

    }
`;

var rayFragmentShader = `
    varying vec3 vColor;
    varying float vBias;
	uniform float opacity;

	void main() {
		gl_FragColor = vec4( vColor, opacity * vBias );
	}
`;

// setup ThreeJS
var contentScene; // contains rays
var viewportCamera;
var rayShaderMaterial;

var renderer;
var raysMesh;

function init(){
	var canvas = document.getElementById("three");
	renderer = new THREE.WebGLRenderer({canvas: canvas, alpha: true});
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	viewportCamera = new THREE.OrthographicCamera(0, window.innerWidth, 0, window.innerHeight, 0, 1000);
	contentScene = new THREE.Scene();

	// Create content scene, and render target
	contentScene = new THREE.Scene();
	rayShaderMaterial = new THREE.ShaderMaterial({
		uniforms:{
			opacity: {value: 1.0}
		},
		vertexShader: rayVertexShader,
		fragmentShader: rayFragmentShader,
		blending: THREE.AdditiveBlending,
		depthTest: false,
		transparent: true,
		vertexColors: THREE.VertexColors
	});
	updateContentGeometry();
}

function resize(){
	viewportCamera.aspect = window.innerWidth / window.innerHeight;
    viewportCamera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
}
window.addEventListener('resize', resize);

function updateContentGeometry(){
	// Reset and populate attributes
	var positions = [];
	var normals = [];
	var colors = [];
	for ( var ray of PAPER.project.layers['rays'].children) {
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

	// Create mesh, and replace in scene
	if(raysMesh)
		contentScene.remove(raysMesh);
	raysMesh = new THREE.LineSegments( rayGeometry, rayShaderMaterial );
	contentScene.add( raysMesh );
}

init();

/* ===========================
 *       Render Passes
   ===========================  */
var mergeVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`

var mergeFragmentShader = `
  uniform sampler2D texA;
  uniform sampler2D texB;
  varying vec2 vUv;

  void main() {
    vec4 texelA = texture2D(texA, vUv);
    vec4 texelB = texture2D(texB, vUv);
    gl_FragColor = texelA + texelB;
  }
`

var tonemapperVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`

var tonemapperFragmentShader = `
  varying vec2 vUv;
  uniform float factor;
  uniform sampler2D map;
  void main() {
    vec4 texel = texture2D(map, vUv);
    gl_FragColor = texel * factor;
  }
`

var compCamera;
var compScene; // contains old and new frame
var screenScene; // final composited frames on a quad
var tonemapperScene;
var compInputAFbo; // containt composited frames frames
var compInputBFbo;
var tonemapperInputFbo;
var screenInputFbo; // contains previous frame rendered on screen
var compShaderMaterial;
var tonemapperShaderMaterial;
var screenMaterial;



function createRenderTarget(){
	return new THREE.WebGLRenderTarget(window.innerWidth*devicePixelRatio , window.innerHeight*devicePixelRatio,
		{
			minFilter: THREE.NearestFilter, 
			magFilter: THREE.NearestFilter, 
			format: THREE.RGBAFormat,
			type: THREE.FloatType
		}
	);
}


{
	// compInputAFbo = createRenderTarget();

	// compInputBFbo = createRenderTarget();

	// compCamera = new THREE.OrthographicCamera(-1, 1, -1, 1, 0, 1000);
	// var plateGeometry = new THREE.PlaneBufferGeometry( 2, 2 );
	// compShaderMaterial = new THREE.ShaderMaterial({
	// 	uniforms:{
	// 		tOld: {value: compInputAFbo.texture},
	// 		tNew: {value: compInputBFbo.texture}
	// 	},
	// 	vertexShader: compVertexShader,
	// 	fragmentShader: compFragmentShader
	// });

	// plate = new THREE.Mesh(plateGeometry, compShaderMaterial);
	// plate.scale.set(1,1,-1);

	// compScene = new THREE.Scene();
	// compScene.add(plate)


	// // Create tonamepper scene ()
	// tonemapperInputFbo = createRenderTarget();
	// tonemapperScene = new THREE.Scene();
	// var tonemapperGeo = new THREE.PlaneBufferGeometry(2, 2);
	// tonemapperShaderMaterial = new THREE.ShaderMaterial({
	// 	uniforms: {
	// 		map: {value: tonemapperInputFbo.texture},
	// 		factor: {value: 1.0}
	// 	},
	// 	vertexShader: tonemapperVertexShader,
	// 	fragmentShader: tonemapperFragmentShader
	// });
	// var tonemapperMesh = new THREE.Mesh(tonemapperGeo, tonemapperShaderMaterial);
	// tonemapperMesh.scale.set(1,1,-1);
	// tonemapperScene.add(tonemapperMesh);
	

	// // Create screen scene (renders to screen, and screenFbo)
	// screenInputFbo = createRenderTarget();
	// screenScene = new THREE.Scene();
	// var screenGeo = new THREE.PlaneBufferGeometry(2,2);
	// screenMaterial = new THREE.MeshBasicMaterial({
	// 	color: "white",
	// 	map: screenInputFbo.texture
	// });
	// var screenMesh = new THREE.Mesh(screenGeo, screenMaterial);
	// screenMesh.scale.set(1,1,-1);
	// screenScene.add(screenMesh);
}


var textureNew;
var textureOld;
var textureComp;

var compCamera;
var mergeScene;

function initRenderPasses(){
	//
	textureOld = createRenderTarget();
	textureNew = createRenderTarget();
	textureComp = createRenderTarget();

	// merge pass
	var plateGeometry = new THREE.PlaneBufferGeometry( 2, 2 );
	compCamera = new THREE.OrthographicCamera(-1, 1, -1, 1, -10, 10);
	compCamera.position.z = -1;
	// compCamera.rotation.set(0,Math.PI, 0);
	
	var mergeMaterial = new THREE.ShaderMaterial({
		uniforms:{
			texA: {value: textureOld.texture},
			texB: {value: textureNew.texture}
		},
		vertexShader: mergeVertexShader,
		fragmentShader: mergeFragmentShader,
		transparent: true
	});

	var quadMerge = new THREE.Mesh(plateGeometry, mergeMaterial);
	quadMerge.scale.set(1,1,-1);
	mergeScene = new THREE.Scene();
	mergeScene.add(quadMerge);

	// screen pass
	var screenMaterial = new THREE.MeshBasicMaterial({color: 'white', map: textureComp.texture});
	var quadScreen = new THREE.Mesh(plateGeometry, screenMaterial);
	quadScreen.scale.set(1,1,-1);
	sceneScreen = new THREE.Scene();
	sceneScreen.add(quadScreen);
}

function renderPasses(){
  // draw
  renderer.setRenderTarget(textureNew);
  renderer.render(contentScene, viewportCamera);

  renderer.setRenderTarget(textureComp);
  renderer.render(mergeScene, compCamera);

  renderer.setRenderTarget(textureOld);
  renderer.render(sceneScreen, compCamera);

  renderer.setRenderTarget(null)
  renderer.render(sceneScreen, compCamera);
}

initRenderPasses();

// main render loop
var i=0;
function render() {
	// rayShaderMaterial.uniforms.opacity.value = Intensity/SampleCount;
	i++;
	updateContentGeometry();
	renderPasses();
	// render passes


	// render rays to fbo
	// renderer.setRenderTarget(contentOutputFbo);
	// renderer.render( contentScene, viewportCamera );

	// renderer.setRenderTarget(compFbo);
	// renderer.render( compScene, compCamera);

	// renderer.setRenderTarget(compInputBFbo);
	// renderer.render( compScene, compCamera);



	// // render composite texture to screen
	// renderer.setRenderTarget(screenInputFbo);
	// renderer.render(tonemapperScene, compCamera);

	// render screen plate
	// screenMaterial.map = contentOutputFbo;
	// renderer.setRenderTarget(null);
	// renderer.render(contentScene , viewportCamera)

	requestAnimationFrame( render );
}
render();


// additional render gui
// gui.add(tonemapperShaderMaterial.uniforms.factor, 'value', 0, 10).name('brightness');
// function tonemapper(map, options = {}){
// 	// 
// 	var scene new THREE.Scene();
// 	var geo = new THREE.PlaneBufferGeometry(2,2);
// 	var shaderMaterial = new THREE.ShaderMaterial({
// 		uniforms: {
// 			map: {value: map}
// 			factor: {value: options.factor | 1.0}
// 		}
// 	});
// 	var mesh = new THREE.Mesh(geo, shaderMaterial);
// 	return scene;
// }

// render(contentScene, with: viewportCamera, to: contentFbo);
// render(tonemapper(contentFbo, {factor: 1.0}), with: compCamera, )







