
/*
 * LAST ICE
 * Version 1 - Primera escena 3D
 */

// Variables globales
var renderer, scene, camera;
var cameraControls;
var personaje;
var brazoIzquierdo, brazoDerecho;
var piernaIzquierda, piernaDerecha;
var tiempo = 0;
var teclas = {};
var velocidad = 0.05;

var objetosSuelo = [];
var raycasterSuelo = new THREE.Raycaster();
var raycasterObstaculos = new THREE.Raycaster();
var grupoObstaculos = new THREE.Group();

// Caja de colision del personaje
var cajaPersonaje = new THREE.Box3();

// Dimensiones aproximadas del cuerpo
var mitadAnchura = 0.5;
var alturaPersonaje = 1.3;
var mitadProfundidad = 0.5;


 // Salto y gravedad
var gravedad = -18;
var impulsoSalto = 7;
var velocidadVertical = 0;
var enSuelo = true;


// Camara de seguimiento (adaptada de TRON)
var camaraOrbital = false;

var distanciaCamara = 3.5;
var alturaCamara = 2.2;
var alturaMirada = 0.8;

var posicionObjetivoCamara = new THREE.Vector3();
var miradaObjetivoCamara = new THREE.Vector3();
var miradaActualCamara = new THREE.Vector3();

var velocidadCamara = new THREE.Vector3();
var velocidadMiradaCamara = new THREE.Vector3();
var aceleracionCamara = new THREE.Vector3();

var rigidezCamara = 50;
var amortiguacionCamara = 14;

var camaraIniciada = false;
var clock = new THREE.Clock();


// Inicializacion del programa
init();
loadScene();
render();

// Configuracion del renderer, escena y camara
function init()
{
    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    document.getElementById('container').appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x171326);

    // Camara en perspectiva
    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );

    camera.position.set(10, 8, 12);
    camera.lookAt(0, 0, 0);

    // Controles de camara con el raton
    cameraControls = new THREE.OrbitControls(
        camera,
        renderer.domElement
    );

    cameraControls.target.set(0, 0, 0);
    cameraControls.update();
    cameraControls.enabled = false;
    cameraControls.enableKeys = false;

    window.addEventListener('resize', updateAspectRatio);

    // Detectar cuando se pulsa una tecla
    
    window.addEventListener('keydown', function(event) {
        if (event.key.startsWith('Arrow')) {
            event.preventDefault();
        }
        if (event.key.toLowerCase() === 'c' && !event.repeat) {
            cambiarCamara();
        }
        if (event.code === 'Space') {
            event.preventDefault();

            if (enSuelo) {
                velocidadVertical = impulsoSalto;
                enSuelo = false;
            }
        }
        teclas[event.key.toLowerCase()] = true;
    });

    // Detectar cuando se suelta una tecla
    window.addEventListener('keyup', function(event) {
        if (event.key.startsWith('Arrow')) {
            event.preventDefault();
        }
        teclas[event.key.toLowerCase()] = false;
    });
}

// Construccion de los objetos de la escena
function loadScene()
{
    scene.add(grupoObstaculos);

    // 1. Barra de la discoteca
    var geometriaBarra = new THREE.BoxGeometry(12, 1, 5);
    var materialBarra = new THREE.MeshNormalMaterial();

    var barra = new THREE.Mesh(geometriaBarra, materialBarra);
    barra.position.y = -0.5;
    scene.add(barra);
    objetosSuelo.push(barra);

    // Plataforma elevada de prueba
    var geometriaPlataforma = new THREE.BoxGeometry(2, 0.5, 2);
    var materialPlataforma = new THREE.MeshNormalMaterial();

    var plataforma = new THREE.Mesh(
        geometriaPlataforma,
        materialPlataforma
    );

    plataforma.position.set(0, 0.25, 0);
    grupoObstaculos.add(plataforma);
    objetosSuelo.push(plataforma);
    
    // 2. Personaje: cubito de hielo
    personaje = new THREE.Group();

    // Materiales
    var materialHielo = new THREE.MeshBasicMaterial({
        color: 0x8deaff
    });

    var materialExtremidades = new THREE.MeshBasicMaterial({
        color: 0x54bcd6
    });

    var materialOjos = new THREE.MeshBasicMaterial({
        color: 0x111111
    });

    // Cuerpo
    var cuerpo = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        materialHielo
    );
    cuerpo.position.y = 0.8;
    personaje.add(cuerpo);

    
    // Articulacion del brazo izquierdo
    brazoIzquierdo = new THREE.Group();
    brazoIzquierdo.position.set(-0.58, 0.95, 0);

    var mallaBrazoIzquierdo = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.6, 0.2),
        materialExtremidades
    );

    // El brazo cuelga desde el hombro
    mallaBrazoIzquierdo.position.y = -0.3;
    brazoIzquierdo.add(mallaBrazoIzquierdo);
    personaje.add(brazoIzquierdo);

    // Articulacion del brazo derecho
    brazoDerecho = new THREE.Group();
    brazoDerecho.position.set(0.58, 0.95, 0);

    var mallaBrazoDerecho = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.6, 0.2),
        materialExtremidades
    );

    mallaBrazoDerecho.position.y = -0.3;
    brazoDerecho.add(mallaBrazoDerecho);
    personaje.add(brazoDerecho);

    
    // Articulacion de la pierna izquierda
    piernaIzquierda = new THREE.Group();
    piernaIzquierda.position.set(-0.25, 0.35, 0);

    var mallaPiernaIzquierda = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.35, 0.2),
        materialExtremidades
    );

    mallaPiernaIzquierda.position.y = -0.175;
    piernaIzquierda.add(mallaPiernaIzquierda);
    personaje.add(piernaIzquierda);

    // Articulacion de la pierna derecha
    piernaDerecha = new THREE.Group();
    piernaDerecha.position.set(0.25, 0.35, 0);

    var mallaPiernaDerecha = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.35, 0.2),
        materialExtremidades
    );

    mallaPiernaDerecha.position.y = -0.175;
    piernaDerecha.add(mallaPiernaDerecha);
    personaje.add(piernaDerecha);


    // Ojos
    var geometriaOjo = new THREE.SphereGeometry(
        0.09, 16, 16
    );

    var ojoIzquierdo = new THREE.Mesh(
        geometriaOjo, materialOjos
    );
    ojoIzquierdo.position.set(-0.2, 0.95, 0.51);
    personaje.add(ojoIzquierdo);

    var ojoDerecho = new THREE.Mesh(
        geometriaOjo, materialOjos
    );
    ojoDerecho.position.set(0.2, 0.95, 0.51);
    personaje.add(ojoDerecho);

    // Colocamos el personaje sobre la barra
    personaje.position.set(-4, 0, 0);
    scene.add(personaje);

    // 3. Vaso (forma provisional)
    var geometriaVaso = new THREE.CylinderGeometry(
        0.7, 0.5, 1.8, 32
    );
    var materialVaso = new THREE.MeshNormalMaterial();

    var vaso = new THREE.Mesh(geometriaVaso, materialVaso);
    vaso.position.set(4, 0.9, 0);
    grupoObstaculos.add(vaso);
}

// Adaptar la camara al tamaño de la ventana
function updateAspectRatio()
{
    renderer.setSize(window.innerWidth, window.innerHeight);

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}

// Actualizaciones de la escena



function update()
{
    // cameraControls.update();

    // Direccion de movimiento
    var dx = 0;
    var dz = 0;

    if (teclas['arrowup'] || teclas['w']) {
        dz -= 1;
    }

    if (teclas['arrowdown'] || teclas['s']) {
        dz += 1;
    }

    if (teclas['arrowleft'] || teclas['a']) {
        dx -= 1;
    }

    if (teclas['arrowright'] || teclas['d']) {
        dx += 1;
    }

    var moviendo = (dx !== 0 || dz !== 0);

    if (moviendo) {
        // Normalizar para no correr mas en diagonal
        var longitud = Math.sqrt(dx * dx + dz * dz);
        dx /= longitud;
        dz /= longitud;

        // Desplazar al personaje
        if (!hayObstaculo(dx, dz)) {
            personaje.position.x += dx * velocidad;
            personaje.position.z += dz * velocidad;
        }

        // Girar hacia la direccion de movimiento
        personaje.rotation.y = Math.atan2(dx, dz);

        // Animar las extremidades
        tiempo += 0.15;

        piernaIzquierda.rotation.x = Math.sin(tiempo) * 0.5;
        piernaDerecha.rotation.x = -Math.sin(tiempo) * 0.5;

        brazoIzquierdo.rotation.x = -Math.sin(tiempo) * 0.5;
        brazoDerecho.rotation.x = Math.sin(tiempo) * 0.5;
    }
    else {
        // Detener la animacion
        piernaIzquierda.rotation.x = 0;
        piernaDerecha.rotation.x = 0;

        brazoIzquierdo.rotation.x = 0;
        brazoDerecho.rotation.x = 0;
    }

    // Limites provisionales de la barra
    personaje.position.x = THREE.MathUtils.clamp(
        personaje.position.x, -5.2, 5.2
    );

    personaje.position.z = THREE.MathUtils.clamp(
        personaje.position.z, -1.9, 1.9
    );

    
    // Tiempo transcurrido desde el fotograma anterior
    var delta = Math.min(clock.getDelta(), 0.05);

    // Actualizar salto y gravedad
    actualizarSalto(delta);

    // Actualizar la camara activa
    if (camaraOrbital) {
        cameraControls.update();
    }
    else {
        updateCamera(delta);
    }

}




// Bucle de renderizado
function render()
{
    requestAnimationFrame(render);
    update();
    renderer.render(scene, camera);
}



// Movimiento amortiguado de la camara (spring)
function actualizarResorte(actual, velocidadActual, objetivo, delta)
{
    aceleracionCamara.copy(objetivo).sub(actual);
    aceleracionCamara.multiplyScalar(rigidezCamara);
    aceleracionCamara.addScaledVector(
        velocidadActual, -amortiguacionCamara
    );

    velocidadActual.addScaledVector(aceleracionCamara, delta);
    actual.addScaledVector(velocidadActual, delta);
}

// Camara en tercera persona, adaptada de TRON
function updateCamera(delta)
{
    // Direccion hacia la que mira el cubito
    // var direccion = new THREE.Vector3(
    //     Math.sin(personaje.rotation.y),
    //     0,
    //     Math.cos(personaje.rotation.y)
    // );
    var direccion = new THREE.Vector3(0, 0, -1);

    // Posicion deseada: detras y por encima
    posicionObjetivoCamara.copy(personaje.position);
    posicionObjetivoCamara.addScaledVector(
        direccion, -distanciaCamara
    );
    posicionObjetivoCamara.y += alturaCamara;

    // Punto al que mira la camara
    miradaObjetivoCamara.copy(personaje.position);
    miradaObjetivoCamara.y += alturaMirada;

    if (!camaraIniciada) {
        camera.position.copy(posicionObjetivoCamara);
        miradaActualCamara.copy(miradaObjetivoCamara);
        velocidadCamara.set(0, 0, 0);
        velocidadMiradaCamara.set(0, 0, 0);
        camaraIniciada = true;
    }
    else {
        actualizarResorte(
            camera.position,
            velocidadCamara,
            posicionObjetivoCamara,
            delta
        );

        actualizarResorte(
            miradaActualCamara,
            velocidadMiradaCamara,
            miradaObjetivoCamara,
            delta
        );
    }

    camera.lookAt(miradaActualCamara);
}

// Alternar entre seguimiento y camara orbital
function cambiarCamara()
{
    camaraOrbital = !camaraOrbital;
    cameraControls.enabled = camaraOrbital;

    if (camaraOrbital) {
        cameraControls.target.copy(personaje.position);
        cameraControls.target.y += alturaMirada;
        cameraControls.update();
    }
    else {
        velocidadCamara.set(0, 0, 0);
        velocidadMiradaCamara.set(0, 0, 0);
        miradaActualCamara.copy(cameraControls.target);
        camaraIniciada = true;
    }
}




function actualizarSalto(delta)
{
    // Lanzamos un rayo hacia abajo desde el personaje
    var origenRayo = personaje.position.clone();
    origenRayo.y += 0.5;

    raycasterSuelo.set(
        origenRayo,
        new THREE.Vector3(0, -1, 0)
    );

    var intersecciones = raycasterSuelo.intersectObjects(
        objetosSuelo
    );

    var alturaSuelo = -Infinity;

    if (intersecciones.length > 0) {
        alturaSuelo = intersecciones[0].point.y;
    }

    // Si estaba apoyado y ya no tiene suelo bajo los pies,
    // comienza a caer.
    if (enSuelo && personaje.position.y > alturaSuelo + 0.01) {
        enSuelo = false;
        velocidadVertical = 0;
    }

    if (!enSuelo) {
        velocidadVertical += gravedad * delta;
        personaje.position.y += velocidadVertical * delta;

        // Solo aterrizamos cuando estamos descendiendo
        if (velocidadVertical <= 0 &&
            personaje.position.y <= alturaSuelo) {

            personaje.position.y = alturaSuelo;
            velocidadVertical = 0;
            enSuelo = true;
        }
    }
}



function hayObstaculo(dx, dz)
{
    // Caja del personaje en su posicion actual
    var cajaActual = new THREE.Box3(
        new THREE.Vector3(
            personaje.position.x - mitadAnchura,
            personaje.position.y + 0.05,
            personaje.position.z - mitadProfundidad
        ),
        new THREE.Vector3(
            personaje.position.x + mitadAnchura,
            personaje.position.y + alturaPersonaje,
            personaje.position.z + mitadProfundidad
        )
    );

    // Caja del personaje en la siguiente posicion
    var siguienteX = personaje.position.x + dx * velocidad;
    var siguienteZ = personaje.position.z + dz * velocidad;

    var cajaSiguiente = new THREE.Box3(
        new THREE.Vector3(
            siguienteX - mitadAnchura,
            personaje.position.y + 0.05,
            siguienteZ - mitadProfundidad
        ),
        new THREE.Vector3(
            siguienteX + mitadAnchura,
            personaje.position.y + alturaPersonaje,
            siguienteZ + mitadProfundidad
        )
    );

    grupoObstaculos.updateMatrixWorld(true);

    var obstaculoDetectado = false;

    grupoObstaculos.traverse(function(objeto) {
        if (!objeto.isMesh) return;

        var cajaObstaculo = new THREE.Box3().setFromObject(objeto);

        var colisionActual = cajaActual.intersectsBox(cajaObstaculo);
        var colisionSiguiente = cajaSiguiente.intersectsBox(cajaObstaculo);

        // Bloquear si entramos en un obstaculo
        if (!colisionActual && colisionSiguiente) {
            obstaculoDetectado = true;
        }

        // Si ya estamos dentro, comparar cuanto se superponen
        if (colisionActual && colisionSiguiente) {

            var interseccionActual = cajaActual.clone()
                .intersect(cajaObstaculo);

            var interseccionSiguiente = cajaSiguiente.clone()
                .intersect(cajaObstaculo);

            var volumenActual =
                interseccionActual.getSize(new THREE.Vector3())
                .lengthSq();

            var volumenSiguiente =
                interseccionSiguiente.getSize(new THREE.Vector3())
                .lengthSq();

            // Bloquear solo si aumenta la superposicion
            if (volumenSiguiente > volumenActual + 0.000001) {
                obstaculoDetectado = true;
            }
        }
    });

    return obstaculoDetectado;
}
