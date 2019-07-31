var Shaders = {
	ray:{
		vertex: `
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
			`,
		fragment: `
		    varying vec3 vColor;
		    varying float vBias;
			uniform float opacity;

			void main() {
				gl_FragColor = vec4( vColor, opacity * vBias );
			}
			`
	},

	merge:{
		vertex: `
			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}
			`,
		fragment: `
			uniform sampler2D texA;
			uniform sampler2D texB;
			varying vec2 vUv;

			void main() {
				vec4 texelA = texture2D(texA, vUv);
				vec4 texelB = texture2D(texB, vUv);
				gl_FragColor = texelA + texelB;
			}
			`
	},

	toner: {
		vertex: `
			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}
			`,
		fragment: `
			varying vec2 vUv;
			uniform float factor;
			uniform sampler2D map;
			void main() {
				vec4 texel = texture2D(map, vUv);
				gl_FragColor = texel/factor;
			}
			`
	}
}

class RenderPass{
	static get renderer(){
		return this._renderer;
	}

	static set renderer(renderer){
		this._renderer = renderer;
	}

	constructor(material, target){
		this.material = material;
		this.material.transparent = false;
		this.material.depthTest = false;
		this.target = target;
		this.scene = new THREE.Scene();
		this.camera = new THREE.OrthographicCamera(-1, 1, -1, 1, -10, 10);
		this.camera.position.z = -1;
		this.camera.rotation.set(0, Math.PI, Math.PI);
		const geo = new THREE.PlaneBufferGeometry(2,2);
		this.mesh = new THREE.Mesh(geo, this.material);
		this.scene.add(this.mesh);
	}

	render(){
		RenderPass._renderer.setRenderTarget(this.target);
		RenderPass._renderer.render(this.scene, this.camera);
	}
}

// setup ThreeJS
var renderer;
var contentScene;
var viewportCamera;
var rayShaderMaterial;

var sceneFbo;
var bufferFbo;
var compFbo;

var accumulatePass;
var copyPass;
var tonerPass;

var iterationCounter=0;
var reset = false;

function resizeRenderer(){
	// viewportCamera.aspect = window.innerWidth / window.innerHeight;
	viewportCamera.right = window.innerWidth;
	viewportCamera.bottom = window.innerHeight;
    viewportCamera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
    reset=true;
}

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

function initRenderer(){
	// setup threejs renderer
	const canvas = document.getElementById("three");
	renderer = new THREE.WebGLRenderer({canvas: canvas, alpha: true});
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);

	// create scene
	viewportCamera = new THREE.OrthographicCamera(0, window.innerWidth, 0, window.innerHeight, 0, 1000);
	contentScene = new THREE.Scene();

	// Create content scene, and render target
	contentScene = new THREE.Scene();
	rayShaderMaterial = new THREE.ShaderMaterial({
		uniforms:{
			opacity: {value: 1.0}
		},
		vertexShader: Shaders.ray.vertex,
		fragmentShader: Shaders.ray.fragment,
		blending: THREE.AdditiveBlending,
		depthTest: false,
		transparent: true,
		vertexColors: THREE.VertexColors
	});

	window.addEventListener('resize', resizeRenderer);
}

function initRenderPasses(){
	//             scene  -> 
	//                        merge->comp->toner->null
	// comp->copy->buffer ->
	RenderPass.renderer = renderer;

	bufferFbo = createRenderTarget();
	sceneFbo = createRenderTarget();
	compFbo = createRenderTarget();

	//accumulate pass
	accumulatePass = new RenderPass(
		new THREE.ShaderMaterial({
			uniforms:{
				texA: {value: sceneFbo.texture},
				texB: {value: bufferFbo.texture}
			},
			vertexShader: Shaders.merge.vertex,
			fragmentShader: Shaders.merge.fragment
		}), 
		compFbo
	);

	// screen pass
	copyPass = new RenderPass(
		new THREE.MeshBasicMaterial({color: 'white', map: compFbo.texture}),
		bufferFbo
	);

	//tonerPass
	tonerPass = new RenderPass(
		new THREE.ShaderMaterial({
			uniforms:{
				map: {value: compFbo.texture},
				factor: {value: 1}
			},
			vertexShader: Shaders.toner.vertex,
			fragmentShader: Shaders.toner.fragment
		}),
		null
	);
}

function renderPasses(){
	// render rays to texture
	renderer.setRenderTarget(sceneFbo);
	renderer.render(contentScene, viewportCamera);

	accumulatePass.render();
	if(reset){
		copyPass.renderer.setRenderTarget(copyPass.target);
		copyPass.renderer.clear();
		iterationCounter=0;
		reset = false;
	}else{
		copyPass.render();
	}

	// render final **fluence
	tonerPass.render();
}

initRenderer();
initRenderPasses();