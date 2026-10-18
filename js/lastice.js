
/* LAST ICE - Supervivencia | Three.js r140 (scripts clasicos)
   Controles: WASD/flechas mover, ESPACIO saltar, C camara, R reiniciar. */

var renderer, scene, camera, cameraControls, personaje;
var brazoIzquierdo, brazoDerecho, piernaIzquierda, piernaDerecha, cuerpoHielo;
var teclas = {}, grupoObstaculos = new THREE.Group(), objetosSuelo = [];
var raycasterSuelo = new THREE.Raycaster(), clock = new THREE.Clock();
var velocidad = 6.3, gravedad = -18, impulsoSalto = 8;
var velocidadVertical = 0, enSuelo = true, tiempoAnimacion = 0;
var mitadAnchura = 0.46, mitadProfundidad = 0.46, alturaPersonaje = 1.3;
var anchoMundo = 42, fondoMundo = 30;
var camaraOrbital = false, camaraIniciada = false;
var posicionObjetivoCamara = new THREE.Vector3(), miradaObjetivoCamara = new THREE.Vector3();
var miradaActualCamara = new THREE.Vector3(), velocidadCamara = new THREE.Vector3();
var velocidadMiradaCamara = new THREE.Vector3(), aceleracionCamara = new THREE.Vector3();
var rigidezCamara = 35, amortiguacionCamara = 12;
var cubatas = [], zonasTermicas = [], lucesAnimadas = [];
var vasosRecogidos = 0, objetivoVasos = 5, hielo = 100, duracion = 300, tiempoRestante = duracion;
var estado = 'jugando', hud, mensajeFinal, indicadorZona;
var materialHielo;
var obstaculosMoviles = [];

var tiempoUltimoGolpe = -100;
var penalizacionGolpe = 12;

init();
loadScene();
crearInterfaz();
reiniciarJuego();
render();

function init() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;

    document.getElementById('container').appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x100d21);
    scene.fog = new THREE.Fog(0x100d21, 75, 220);

    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 300);
    camera.position.set(0, 8, 12);

    cameraControls = new THREE.OrbitControls(camera, renderer.domElement);
    cameraControls.enabled = false;
    cameraControls.enableKeys = false;
    cameraControls.enableDamping = true;
    cameraControls.minDistance = 3;
    cameraControls.maxDistance = 110;
    cameraControls.maxPolarAngle = Math.PI / 2.05;

    window.addEventListener('resize', updateAspectRatio);

    window.addEventListener('keydown', function(event) {
        var k = event.key.toLowerCase();

        if (event.code === 'Space' || event.key.indexOf('Arrow') === 0) {
            event.preventDefault();
        }

        if (k === 'c' && !event.repeat) cambiarCamara();
        if (k === 'r' && !event.repeat) reiniciarJuego();

        if (event.code === 'Space' && !event.repeat && estado === 'jugando' && enSuelo) {
            velocidadVertical = impulsoSalto;
            enSuelo = false;
        }

        teclas[k] = true;
    });

    window.addEventListener('keyup', function(event) {
        teclas[event.key.toLowerCase()] = false;
    });

    window.addEventListener('blur', function() {
        teclas = {};
    });
}

function material(color, extra) {
    return new THREE.MeshStandardMaterial(
        Object.assign({ color: color, roughness: 0.55 }, extra || {})
    );
}

function caja(x, y, z, ancho, alto, fondo, mat, grupo) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    (grupo || scene).add(m);
    return m;
}

function obstaculo(x, z, ancho, alto, fondo, color, plataforma) {
    var m = caja(
        x, alto / 2, z, ancho, alto, fondo,
        material(color), grupoObstaculos
    );

    // Todos los obstáculos sólidos tienen superficie superior.
    objetosSuelo.push(m);
    // IMPORTANTE: devolver el objeto 3D creado.
    return m
}


function loadScene() {
    scene.add(grupoObstaculos);
    scene.add(new THREE.HemisphereLight(0x9cbdff, 0x30203e, 1.15));

    var foco = new THREE.DirectionalLight(0xffffff, 1.1);
    foco.position.set(-7, 15, 8);
    foco.castShadow = true;
    foco.shadow.mapSize.set(1024, 1024);
    foco.shadow.camera.left = -23;
    foco.shadow.camera.right = 23;
    foco.shadow.camera.top = 18;
    foco.shadow.camera.bottom = -18;
    scene.add(foco);

    var suelo = caja(0, -0.5, 0, anchoMundo, 1, fondoMundo,
        material(0x292439, { roughness: 0.35, metalness: 0.2 }));
    objetosSuelo.push(suelo);

    var matLinea = new THREE.MeshBasicMaterial({ color: 0x51446b });

    for (var x = -20; x <= 20; x += 2) {
        caja(x, 0.012, 0, 0.025, 0.018, fondoMundo, matLinea);
    }

    for (var z = -14; z <= 14; z += 2) {
        caja(0, 0.013, z, anchoMundo, 0.018, 0.025, matLinea);
    }

    // Paredes
    var matPared = material(0x30253e, { roughness: 0.75 });
    var alturaPared = 45;

    caja(0, alturaPared / 2, -15.2, 42.5, alturaPared, 0.4, matPared);
    caja(0, alturaPared / 2, 15.2, 42.5, alturaPared, 0.4, matPared);
    caja(-21.2, alturaPared / 2, 0, 0.4, alturaPared, 30.5, matPared);
    caja(21.2, alturaPared / 2, 0, 0.4, alturaPared, 30.5, matPared);

    var neon = new THREE.MeshBasicMaterial({ color: 0x6b9fff });
    caja(0, 2.9, -14.97, 41, 0.07, 0.07, neon);
    caja(0, 2.9, 14.97, 41, 0.07, 0.07, neon);

    caja(
        0, 45.2, 0, 42.5, 0.4, 30.5,
        material(0x171123, {
            roughness: 0.9,
            side: THREE.DoubleSide
        })
    );

    // Plataformas y mesas
    obstaculo(-13, -7, 3, 0.65, 3, 0x865cb5, true);
    obstaculo(-5, 6, 3, 1.05, 3, 0x4f88b2, true);
    obstaculo(5, -6, 3.4, 0.9, 3, 0x9d638a, true);
    obstaculo(14, 7, 3.2, 1.1, 3.2, 0x527e9e, true);
    obstaculo(0, 0, 3.2, 0.75, 3.2, 0x795e9c, true);

    // Obstaculos fijos
    [
        [-16, 4, 2, 1.5, 2],
        [-9, -1, 2.5, 1.25, 1.8],
        [-1, -10, 2.4, 1.5, 2.1],
        [8, 2, 2.3, 1.6, 2.3],
        [16, -3, 2.3, 1.4, 2.2],
        [-2, 11, 2.5, 1.4, 1.7],
        [11, -11, 2, 1.4, 2]
    ].forEach(function(o, i) {
        obstaculo(o[0], o[1], o[2], o[3], o[4],
            i % 2 ? 0x765889 : 0x55476d, false);
    });

    // Obstaculos moviles
    crearObstaculoMovil(-11, 10, 3.2, 0, 2.2);
    crearObstaculoMovil(6, 10, 0, 3, 1.5);
    crearObstaculoMovil(13, -7, 3, 0, 1.8);

    // Altavoces
    var matAltavoz = material(0x181723, { metalness: 0.3 });

    [-17, 0, 17].forEach(function(px) {
        caja(px, 1, -14.3, 1.2, 2, 0.7, matAltavoz);

        var cono = new THREE.Mesh(
            new THREE.CylinderGeometry(0.38, 0.38, 0.04, 24),
            new THREE.MeshBasicMaterial({ color: 0x674eaa })
        );

        cono.rotation.x = Math.PI / 2;
        cono.position.set(px, 1, -13.9);
        scene.add(cono);
    });

    // Luces sin esferas flotantes
    [
        [-15, -10, 0x55aaff],
        [0, -10, 0xff44aa],
        [15, -10, 0x55ffaa],
        [-14, 10, 0xff66aa],
        [14, 10, 0x7777ff]
    ].forEach(function(p, i) {
        var luz = new THREE.PointLight(p[2], 2, 17, 2);
        luz.position.set(p[0], 5, p[1]);
        scene.add(luz);
        lucesAnimadas.push({ luz: luz, fase: i * 1.6 });
    });

    crearZona(-18, -11, 2.4, 'fria');
    crearZona(18, 11, 2.4, 'fria');
    crearZona(-3, -7, 2.1, 'caliente', 4, 0, 0.65);
    crearZona(8, 8, 2.1, 'caliente', 0, 4, 0.8);

    crearPersonaje();

    crearCubata(-17, 8, 0);
    crearCubata(-5, 6, 1.05);
    crearCubata(5, -6, 0.9);
    crearCubata(14, 7, 1.1);
    crearCubata(18, -11, 0);


    // Más elementos repartidos por el recinto.
    // Usamos posiciones predefinidas para que el nivel sea repetible.
    var decoracion = [
        [-17,-3], [-15,1], [-12,2], [-10,-10],
        [-8,9], [-7,-5], [-5,-11], [-3,10],
        [-1,4], [1,-7], [2,8], [4,11],
        [6,-11], [7,7], [9,-3], [11,1],
        [13,11], [15,-9], [17,2], [18,5],
        [-18,12], [-12,12], [-7,12],
        [0,-12], [10,12], [17,-13]
    ];

    decoracion.forEach(function(p, i) {
        var ancho = 0.65 + (i % 3) * 0.25;
        var alto = 0.65 + (i % 4) * 0.22;

        obstaculo(
            p[0], p[1],
            ancho, alto, ancho,
            i % 2 === 0 ? 0x684c83 : 0x3f7494,
            true
        );
    });

    // Nuevos obstáculos móviles: barreras de discoteca.
    [
        [-14, -11, 2, 0, 3.4],
        [-10, 5, 0, 2, 3.8],
        [-6, -3, 2, 0, 4.0],
        [-2, 7, 2, 0, 3.6],
        [2, -10, 2, 0, 4.2],
        [4, 5, 0, 2, 4.0],
        [9, -8, 2, 0, 3.7],
        [12, 4, 0, 2, 4.3],
        [17, -1, 0, 2, 3.9],
        [-16, 9, 0, 1.5, 4.4]
    ].forEach(function(o) {
        crearObstaculoMovil(o[0], o[1], o[2], o[3], o[4]);
    });

    // Luces adicionales de discoteca
    for (var i = 0; i < 14; i++) {
        var px = -18 + (i % 7) * 6;
        var pz = i < 7 ? -12 : 12;
        var colores = [0xff2288, 0x22aaff, 0x44ffcc, 0xaa66ff];

        var luz = new THREE.PointLight(
            colores[i % colores.length], 2.4, 18, 2
        );

        luz.position.set(px, 7, pz);
        scene.add(luz);

        lucesAnimadas.push({
            luz: luz,
            fase: i * 0.8
        });
    }

}


function crearZona(x, z, radio, tipo, ax, az, rapidez) {
    var color = tipo === 'fria' ? 0x40baff : 0xff713e;

    var grupo = new THREE.Group();
    grupo.position.set(x, 0, z);
    scene.add(grupo);

    var disco = new THREE.Mesh(
        new THREE.CylinderGeometry(radio, radio, 0.035, 48),
        new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.34,
            depthWrite: false
        })
    );

    disco.position.y = 0.035;
    grupo.add(disco);

    var aro = new THREE.Mesh(
        new THREE.TorusGeometry(radio, 0.07, 8, 60),
        new THREE.MeshBasicMaterial({ color: color })
    );

    aro.rotation.x = Math.PI / 2;
    aro.position.y = 0.07;
    grupo.add(aro);

    var luz = new THREE.PointLight(color, 0.8, radio * 3);
    luz.position.y = 1.3;
    grupo.add(luz);

    zonasTermicas.push({
        x: x,
        z: z,
        baseX: x,
        baseZ: z,
        radio: radio,
        tipo: tipo,
        aro: aro,
        grupo: grupo,
        luz: luz,
        ax: ax || 0,
        az: az || 0,
        rapidez: rapidez || 0
    });
}    

function crearPersonaje() {
    personaje = new THREE.Group();

    materialHielo = material(0x83e6ff, {
        transparent: true,
        opacity: 0.84,
        roughness: 0.16,
        metalness: 0.08
    });

    var matExtremidades = material(0x43a9d2);
    var matOjos = new THREE.MeshBasicMaterial({ color: 0x10152c });

    cuerpoHielo = caja(
        0, 0.8, 0, 1, 1, 1,
        materialHielo, personaje
    );

    function extremidad(x, y, w, h) {
        var g = new THREE.Group();
        g.position.set(x, y, 0);

        caja(0, -h / 2, 0, w, h, w, matExtremidades, g);
        personaje.add(g);

        return g;
    }

    brazoIzquierdo = extremidad(-0.58, 0.95, 0.2, 0.6);
    brazoDerecho = extremidad(0.58, 0.95, 0.2, 0.6);
    piernaIzquierda = extremidad(-0.25, 0.35, 0.2, 0.35);
    piernaDerecha = extremidad(0.25, 0.35, 0.2, 0.35);

    // Ojos
    [-0.2, 0.2].forEach(function(px) {
        var ojo = new THREE.Mesh(
            new THREE.SphereGeometry(0.09, 16, 12),
            matOjos
        );

        ojo.position.set(px, 0.95, 0.51);
        personaje.add(ojo);
    });

    // Sonrisa
    var sonrisa = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.017, 6, 18, Math.PI),
        matOjos
    );

    sonrisa.rotation.z = Math.PI;
    sonrisa.position.set(0, 0.68, 0.515);
    personaje.add(sonrisa);

    scene.add(personaje);
}

function crearCubata(x, z, altura) {
    var g = new THREE.Group();

    var vidrio = material(0xb7edff, {
        transparent: true,
        opacity: 0.4,
        roughness: 0.1,
        metalness: 0.1,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    var vaso = new THREE.Mesh(
        new THREE.CylinderGeometry(0.44, 0.34, 0.95, 24, 1, true),
        vidrio
    );
    vaso.position.y = 0.52;
    g.add(vaso);

    var liquido = new THREE.Mesh(
        new THREE.CylinderGeometry(0.385, 0.335, 0.58, 24),
        material(0xffad4b, { transparent: true, opacity: 0.75 })
    );
    liquido.position.y = 0.35;
    g.add(liquido);

    var borde = new THREE.Mesh(
        new THREE.TorusGeometry(0.44, 0.035, 8, 24),
        material(0xe7ffff, {
            emissive: 0x44bbee,
            emissiveIntensity: 0.5
        })
    );
    borde.rotation.x = Math.PI / 2;
    borde.position.y = 0.99;
    g.add(borde);

    var pajita = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 1.25, 10),
        material(0xff55b5)
    );
    pajita.position.set(0.18, 1.04, 0);
    pajita.rotation.z = 0.22;
    g.add(pajita);

    var halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.78, 0.045, 8, 40),
        new THREE.MeshBasicMaterial({ color: 0xffd978 })
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.08;
    g.add(halo);

    g.position.set(x, altura || 0, z);
    scene.add(g);

    cubatas.push({
        grupo: g,
        x: x,
        z: z,
        altura: altura || 0,
        recogido: false,
        halo: halo
    });
}


function crearInterfaz() {
    var style = document.createElement('style');

    style.textContent = `
        #lastice-hud {
            position: fixed;
            bottom: 18px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10;
            display: flex;
            align-items: center;
            gap: 24px;
            padding: 10px 20px;
            background: rgba(13, 10, 29, 0.82);
            border: 1px solid #6ac9f0;
            border-radius: 30px;
            color: white;
            font: 600 16px Arial, sans-serif;
            white-space: nowrap;
            pointer-events: none;
        }

        #lastice-hud .bar {
            width: 130px;
            height: 12px;
            background: #49314c;
            border-radius: 10px;
            overflow: hidden;
        }

        #lastice-hud .fill {
            height: 100%;
            background: #65e0ff;
        }

        #lastice-final {
            display: none;
            position: fixed;
            inset: 0;
            z-index: 20;
            align-items: center;
            justify-content: center;
            background: #070712b8;
            color: white;
            font-family: Arial, sans-serif;
            text-align: center;
        }

        #lastice-final .panel {
            padding: 35px 45px;
            background: #201b36;
            border: 2px solid #77dbff;
            border-radius: 18px;
        }
    `;

    document.head.appendChild(style);

    hud = document.createElement('div');
    hud.id = 'lastice-hud';
    document.body.appendChild(hud);

    mensajeFinal = document.createElement('div');
    mensajeFinal.id = 'lastice-final';

    mensajeFinal.innerHTML =
        '<div class="panel">' +
        '<h1 id="lastice-titulo"></h1>' +
        '<p id="lastice-detalle"></p>' +
        '<p>Pulsa <b>R</b> para volver a jugar</p>' +
        '</div>';

    document.body.appendChild(mensajeFinal);

    actualizarHUD('');
}

function actualizarHUD(zona) {
    if (!hud) return;

    var min = Math.floor(Math.max(0, tiempoRestante) / 60);
    var seg = Math.floor(Math.max(0, tiempoRestante) % 60);

    var t = min + ':' + (seg < 10 ? '0' : '') + seg;

    var color = hielo < 30 ? '#ff6a77' : '#65e0ff';

    hud.innerHTML =
        '<span>🥤 ' + vasosRecogidos + '/' + objetivoVasos + '</span>' +
        '<span>⏱ ' + t + '</span>' +
        '<span>🧊</span>' +
        '<div class="bar">' +
        '<div class="fill" style="width:' + hielo +
        '%;background:' + color + '"></div>' +
        '</div>';
}


function reiniciarJuego() {
    if (!personaje) return;

    personaje.position.set(-18, 0, 0);
    personaje.rotation.set(0, 0, 0);
    personaje.scale.set(1, 1, 1);

    velocidadVertical = 0;
    enSuelo = true;
    tiempoUltimoGolpe = -100;

    hielo = 100;
    tiempoRestante = duracion;
    vasosRecogidos = 0;
    estado = 'jugando';
    teclas = {};

    cubatas.forEach(function(c) {
        c.recogido = false;
        c.grupo.visible = true;
    });

    if (mensajeFinal) {
        mensajeFinal.style.display = 'none';
    }

    camaraIniciada = false;

    if (camaraOrbital) {
        cameraControls.target.copy(personaje.position);
        cameraControls.target.y += 0.8;

        camera.position.set(
            personaje.position.x,
            8,
            personaje.position.z + 9
        );

        cameraControls.update();
    }

    actualizarHUD('');
}

function terminarJuego(victoria) {
    if (estado !== 'jugando') return;

    estado = victoria ? 'victoria' : 'derrota';

    document.getElementById('lastice-titulo').textContent =
        victoria ? '¡VICTORIA! 🥤' : 'FIN DE LA PARTIDA 🧊';

    document.getElementById('lastice-detalle').textContent =
        victoria ?
        'Has enfriado los cinco cubatas. ¡Misión cumplida!' :
        (hielo <= 0 ?
         'Te has derretido antes de terminar.' :
         'Se ha agotado el tiempo.');

    mensajeFinal.style.display = 'flex';
}

function cajaColision(x, z) {
    return new THREE.Box3(
        new THREE.Vector3(
            x - mitadAnchura,
            personaje.position.y + 0.06,
            z - mitadProfundidad
        ),
        new THREE.Vector3(
            x + mitadAnchura,
            personaje.position.y + alturaPersonaje,
            z + mitadProfundidad
        )
    );
}

function puedeMoverse(x, z) {
    var actual = cajaColision(
        personaje.position.x,
        personaje.position.z
    );

    var siguiente = cajaColision(x, z);
    var permitido = true;

    grupoObstaculos.updateMatrixWorld(true);

    grupoObstaculos.children.forEach(function(m) {
        if (!m.isMesh) return;

        var cajaO = new THREE.Box3().setFromObject(m);

        if (!siguiente.intersectsBox(cajaO)) return;

        if (!actual.intersectsBox(cajaO)) {
            permitido = false;
            return;
        }

        // Permitir salir de una superposicion existente
        var a = actual.clone()
            .intersect(cajaO)
            .getSize(new THREE.Vector3());

        var b = siguiente.clone()
            .intersect(cajaO)
            .getSize(new THREE.Vector3());

        if (b.x * b.y * b.z > a.x * a.y * a.z + 0.0000001) {
            permitido = false;
        }
    });

    return permitido;
}



function superficiesBajoPersonaje() {
    var resultado = [{ altura: 0 }];

    grupoObstaculos.updateMatrixWorld(true);

    objetosSuelo.forEach(function(m) {
        if (m === objetosSuelo[0]) return;

        var b = new THREE.Box3().setFromObject(m);

        // Comprobamos el centro del personaje sobre el objeto.
        if (
            personaje.position.x >= b.min.x + 0.05 &&
            personaje.position.x <= b.max.x - 0.05 &&
            personaje.position.z >= b.min.z + 0.05 &&
            personaje.position.z <= b.max.z - 0.05
        ) {
            resultado.push({ altura: b.max.y });
        }
    });

    return resultado;
}


function actualizarSalto(delta) {
    var pieAnterior = personaje.position.y;
    var superficies = superficiesBajoPersonaje();
    var apoyo = -Infinity;

    superficies.forEach(function(s) {
        if (s.altura <= pieAnterior + 0.025) {
            apoyo = Math.max(apoyo, s.altura);
        }
    });

    if (enSuelo && Math.abs(pieAnterior - apoyo) > 0.035) {
        enSuelo = false;
        velocidadVertical = 0;
    }

    if (enSuelo) {
        personaje.position.y = apoyo;
        return;
    }

    velocidadVertical += gravedad * delta;

    var pieNuevo = pieAnterior + velocidadVertical * delta;

    if (velocidadVertical <= 0) {
        var aterrizaje = -Infinity;

        superficies.forEach(function(s) {
            if (
                pieAnterior >= s.altura - 0.025 &&
                pieNuevo <= s.altura
            ) {
                aterrizaje = Math.max(aterrizaje, s.altura);
            }
        });

        if (aterrizaje > -Infinity) {
            personaje.position.y = aterrizaje;
            velocidadVertical = 0;
            enSuelo = true;
            return;
        }
    }

    personaje.position.y = pieNuevo;
}



function update(delta) {
    if (estado === 'jugando') {
        var tMov = clock.elapsedTime;
        var anteriorX = personaje.position.x;
        var anteriorZ = personaje.position.z;

        obstaculosMoviles.forEach(function(o, i) {
            o.anteriorX = o.m.position.x;
            o.anteriorZ = o.m.position.z;
            o.m.position.x =
                o.x + o.ax * Math.sin(tMov * o.rapidez + i);

            o.m.position.z =
                o.z + o.az * Math.sin(tMov * o.rapidez + i);
        });

        zonasTermicas.forEach(function(z, i) {
            z.x = z.baseX + z.ax * Math.sin(tMov * z.rapidez + i);
            z.z = z.baseZ + z.az * Math.sin(tMov * z.rapidez + i);

            z.grupo.position.set(z.x, 0, z.z);
        });

        var dx =
            (teclas['d'] || teclas['arrowright'] ? 1 : 0) -
            (teclas['a'] || teclas['arrowleft'] ? 1 : 0);

        var dz =
            (teclas['s'] || teclas['arrowdown'] ? 1 : 0) -
            (teclas['w'] || teclas['arrowup'] ? 1 : 0);

        var moviendo = dx !== 0 || dz !== 0;

        if (moviendo) {
            var len = Math.sqrt(dx * dx + dz * dz);
            dx /= len;
            dz /= len;

            var paso = velocidad * delta;

            var nuevoX = THREE.MathUtils.clamp(
                personaje.position.x + dx * paso,
                -20.3,
                20.3
            );

            if (puedeMoverse(nuevoX, personaje.position.z)) {
                personaje.position.x = nuevoX;
            }

            var nuevoZ = THREE.MathUtils.clamp(
                personaje.position.z + dz * paso,
                -14.3,
                14.3
            );

            if (puedeMoverse(personaje.position.x, nuevoZ)) {
                personaje.position.z = nuevoZ;
            }

            personaje.rotation.y = Math.atan2(dx, dz);
            tiempoAnimacion += delta * 11;
        }

        var oscilacion = moviendo ?
            Math.sin(tiempoAnimacion) * 0.5 : 0;

        piernaIzquierda.rotation.x = oscilacion;
        piernaDerecha.rotation.x = -oscilacion;
        brazoIzquierdo.rotation.x = -oscilacion;
        brazoDerecho.rotation.x = oscilacion;

        actualizarSalto(delta);
        comprobarChoquesMoviles(tMov, anteriorX, anteriorZ);

        var zona = '';

        zonasTermicas.forEach(function(z) {
            var d = Math.hypot(
                personaje.position.x - z.x,
                personaje.position.z - z.z
            );

            if (d < z.radio && personaje.position.y < 1.1) {
                zona = z.tipo;
            }
        });

        hielo += (
            zona === 'fria' ? 8 :
            zona === 'caliente' ? -2.7 : -1
        ) * delta;

        hielo = THREE.MathUtils.clamp(hielo, 0, 100);
        tiempoRestante = Math.max(0, tiempoRestante - delta);

        var escala = 0.25 + 0.75 * hielo / 100;
        materialHielo.opacity = 0.35 + 0.49 * hielo / 100;
        personaje.scale.set(escala, escala, escala);

        cubatas.forEach(function(c) {
            var distancia = Math.hypot(
                personaje.position.x - c.x,
                personaje.position.z - c.z
            );

            if (
                !c.recogido &&
                distancia < 0.95 &&
                Math.abs(personaje.position.y - c.altura) < 0.55
            ) {
                c.recogido = true;
                c.grupo.visible = false;
                vasosRecogidos++;
                hielo = Math.min(100, hielo + 12);
            }
        });

        actualizarHUD(zona);

        if (vasosRecogidos >= objetivoVasos) {
            terminarJuego(true);
        }
        else if (hielo <= 0 || tiempoRestante <= 0) {
            terminarJuego(false);
        }
    }

    var t = clock.elapsedTime;

    cubatas.forEach(function(c, i) {
        if (!c.recogido) {
            c.grupo.rotation.y =
                Math.sin(t * 1.4 + i) * 0.18;

            c.halo.scale.setScalar(
                1 + 0.07 * Math.sin(t * 3 + i)
            );
        }
    });

    lucesAnimadas.forEach(function(l) {
        l.luz.intensity =
            1.35 + 0.65 * Math.sin(t * 1.9 + l.fase);
    });

    zonasTermicas.forEach(function(z, i) {
        z.aro.scale.setScalar(
            1 + 0.02 * Math.sin(t * 2 + i)
        );
    });

    if (camaraOrbital) {
        cameraControls.update();
    }
    else {
        updateCamera(delta);
    }
}


function actualizarResorte(actual, vel, objetivo, delta) {
    aceleracionCamara.copy(objetivo)
        .sub(actual)
        .multiplyScalar(rigidezCamara);

    aceleracionCamara.addScaledVector(
        vel, -amortiguacionCamara
    );

    vel.addScaledVector(aceleracionCamara, delta);
    actual.addScaledVector(vel, delta);
}

function updateCamera(delta) {
    // Camara fija respecto al mundo, siguiendo al personaje
    posicionObjetivoCamara.copy(personaje.position)
        .add(new THREE.Vector3(0, 8.2, 10.5));

    miradaObjetivoCamara.copy(personaje.position);
    miradaObjetivoCamara.y += 0.6;

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

function cambiarCamara() {
    camaraOrbital = !camaraOrbital;
    cameraControls.enabled = camaraOrbital;

    if (camaraOrbital) {
        cameraControls.target.copy(personaje.position);
        cameraControls.target.y += 0.6;
        cameraControls.update();
    }
    else {
        velocidadCamara.set(0, 0, 0);
        velocidadMiradaCamara.set(0, 0, 0);
        camaraIniciada = false;
    }
}

function updateAspectRatio() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}

function render() {
    requestAnimationFrame(render);

    var delta = Math.min(clock.getDelta(), 0.05);
    update(delta);

    renderer.render(scene, camera);
}


function crearObstaculoMovil(x, z, amplitudX, amplitudZ, rapidez) {
    var m = obstaculo(x, z, 1.25, 1.05, 1.25, 0xe06c9e, false);

    obstaculosMoviles.push({
        m: m,
        x: x,
        z: z,
        ax: amplitudX,
        az: amplitudZ,
        rapidez: rapidez
    });
}


function comprobarChoquesMoviles(tiempoActual, anteriorX, anteriorZ) {
    var cajaJugador = cajaColision(
        personaje.position.x,
        personaje.position.z
    );

    var choque = false;

    obstaculosMoviles.forEach(function(o) {
        var cajaMovil = new THREE.Box3().setFromObject(o.m);

        if (cajaJugador.intersectsBox(cajaMovil)) {
            choque = true;

            // El obstáculo retrocede si alcanza al personaje.
            if (o.anteriorX !== undefined) {
                o.m.position.x = o.anteriorX;
                o.m.position.z = o.anteriorZ;
                o.m.updateMatrixWorld(true);
            }
        }
    });

    if (!choque) return;

    // Recuperamos la posición anterior del jugador.
    personaje.position.x = anteriorX;
    personaje.position.z = anteriorZ;

    // Evitar que un mismo contacto quite hielo cada fotograma.
    if (tiempoActual - tiempoUltimoGolpe > 1.2) {
        hielo = Math.max(0, hielo - penalizacionGolpe);
        tiempoUltimoGolpe = tiempoActual;
    }
}


