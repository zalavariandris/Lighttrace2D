const rayVertexShader = `
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

const rayFragmentShader = `
    varying vec3 vColor;
    varying float vBias;
	uniform float opacity;

	void main() {
		gl_FragColor = vec4( vColor, opacity * vBias );
	}
`;

// setup ThreeJS
let contentScene; // contains rays
let viewportCamera;
let rayShaderMaterial;

let renderer = {
	renderer: null // threejs webgl renderer
}

function initThree(){
	// setup threejs renderer
	const canvas = document.getElementById("three");
	renderer.renderer = new THREE.WebGLRenderer({canvas: canvas, alpha: true});
	renderer.renderer.setPixelRatio(window.devicePixelRatio);
	renderer.renderer.setSize(window.innerWidth, window.innerHeight);

	// create scene
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
}

function resize(){
	// viewportCamera.aspect = window.innerWidth / window.innerHeight;
	viewportCamera.right = window.innerWidth;
	viewportCamera.bottom = window.innerHeight;
    viewportCamera.updateProjectionMatrix();
    renderer.renderer.setSize( window.innerWidth, window.innerHeight );
    reset=true;
}
window.addEventListener('resize', resize);


/* ===========================
 *       Render Passes
   ===========================  */
const mergeVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`

const mergeFragmentShader = `
  uniform sampler2D texA;
  uniform sampler2D texB;
  varying vec2 vUv;

  void main() {
    vec4 texelA = texture2D(texA, vUv);
    vec4 texelB = texture2D(texB, vUv);
    gl_FragColor = texelA + texelB;
  }
`

const tonemapperVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`

const tonemapperFragmentShader = `
  varying vec2 vUv;
  uniform float factor;
  uniform sampler2D map;
  void main() {
    vec4 texel = texture2D(map, vUv);
    gl_FragColor = texel/factor;
  }
`

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

var compCamera;

var textureNew;
var textureOld;
var textureComp;

var mergeScene;
var tonemapperScene;
var tonerMaterial;
var plateGeometry;``
function initRenderPasses(){
	//
	textureOld = createRenderTarget();
	textureNew = createRenderTarget();
	textureComp = createRenderTarget();

	// merge pass
	plateGeometry = new THREE.PlaneBufferGeometry( 2, 2 );
	compCamera = new THREE.OrthographicCamera(-1, 1, -1, 1, -10, 10);
	compCamera.position.z = -1;
	compCamera.rotation.set(0, Math.PI, Math.PI);
	
	const mergeMaterial = new THREE.ShaderMaterial({
		uniforms:{
			texA: {value: textureOld.texture},
			texB: {value: textureNew.texture}
		},
		vertexShader: mergeVertexShader,
		fragmentShader: mergeFragmentShader,
		transparent: false,
		depthTest: false,
	});

	const quadMerge = new THREE.Mesh(plateGeometry, mergeMaterial);
	// quadMerge.scale.set(1,1,-1);
	mergeScene = new THREE.Scene();
	mergeScene.add(quadMerge);

	// screen pass
	const screenMaterial = new THREE.MeshBasicMaterial({color: 'white', map: textureComp.texture});
	const quadScreen = new THREE.Mesh(plateGeometry, screenMaterial);
	// quadScreen.scale.set(1,1,-1);
	sceneScreen = new THREE.Scene();
	sceneScreen.add(quadScreen);

	// divide final image with pass count
	tonerMaterial = new THREE.ShaderMaterial({
		uniforms:{
			factor: {value: 1},
			map: {value: textureComp.texture}
		},
		vertexShader: tonemapperVertexShader,
		fragmentShader: tonemapperFragmentShader,
		transparent: false,
		depthTest: false
	});
	const quadToner = new THREE.Mesh(plateGeometry, tonerMaterial);
	tonemapperScene = new THREE.Scene();
	tonemapperScene.add(quadToner);
}

let iterationCounter=0;
let reset = false;

function renderPass(shader, target){
	let scene = new THREE.Scene();
	let camera = new THREE.OrthographicCamera();


	renderer.renderer.setRenderTarget(target);
	renderer.render(scene, camera);
}

function renderPasses(){
  // draw
  renderer.renderer.setRenderTarget(textureNew);
  renderer.renderer.render(contentScene, viewportCamera);

  renderer.renderer.setRenderTarget(textureComp);
  renderer.renderer.render(mergeScene, compCamera);

  if(reset){
		renderer.renderer.setRenderTarget(textureOld);
		renderer.renderer.clear();
		iterationCounter=0;
		reset = false;
  }else{
	  renderer.renderer.setRenderTarget(textureOld);
	  renderer.renderer.render(sceneScreen, compCamera);
  }

  // render final **fluence**
  renderer.renderer.setRenderTarget(null)
  renderer.renderer.render(tonemapperScene, compCamera);
}

initThree();
initRenderPasses();