// Variables globales
var renderer, scene, camera;
var cameraControls;

// 1. Inicializa
init();

// 2. Crea la escena
loadScene();

// 3. Renderiza
render();


function init()
{
    renderer = new THREE.WebGLRenderer();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.setClearColor(
        new THREE.Color(0xFFFFFF)
    );

    document
        .getElementById('container')
        .appendChild(renderer.domElement);


    // Escena
    scene = new THREE.Scene();


    // Cámara
    var aspectRatio =
        window.innerWidth / window.innerHeight;

    camera = new THREE.PerspectiveCamera(
        50,
        aspectRatio,
        0.1,
        2000
    );

    camera.position.set(300, 300, 300);


    // Control de cámara con ratón
    cameraControls =
        new THREE.OrbitControls(
            camera,
            renderer.domElement
        );

    cameraControls.target.set(0, 100, 0);


    // Cambio de tamaño de ventana
    window.addEventListener(
        'resize',
        updateAspectRatio
    );
}


function loadScene()
{
    // Material provisional
    let material =
        new THREE.MeshNormalMaterial();


    // Cubo de prueba
    let cubo = new THREE.Mesh(
        new THREE.BoxGeometry(50, 50, 50),
        material
    );

    scene.add(cubo);
}


function updateAspectRatio()
{
    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    camera.aspect =
        window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();
}


function update()
{
    cameraControls.update();
}


function render()
{
    requestAnimationFrame(render);

    update();

    renderer.render(scene, camera);
}

document.getElementById("mensaje").textContent =
    "Brazo robótico - No está terminado";