

/* LAST ICE - Supervivencia 
   Controles: WASD/flechas mover, ESPACIO saltar, C camara, R reiniciar, Q salir al menu. */

var pantallaInicio;
var partidaIniciada = false;

var renderer, scene, camera, cameraControls, personaje;
var brazoIzquierdo, brazoDerecho, piernaIzquierda, piernaDerecha, cuerpoHielo;
var teclas = {}, grupoObstaculos = new THREE.Group(), objetosSuelo = [];
var raycasterSuelo = new THREE.Raycaster(), clock = new THREE.Clock();
var velocidad = 11, gravedad = -18, impulsoSalto = 8;
var velocidadGiro = 2.5;
var velocidadVertical = 0, enSuelo = true, tiempoAnimacion = 0;
var mitadAnchura = 0.46, mitadProfundidad = 0.46, alturaPersonaje = 1.3;
var anchoMundo = 70, fondoMundo = 75;
var modoCamara = 0; // 0 sigue al hielo, 1 vista de mapa
var camaraIniciada = false;
var posicionObjetivoCamara = new THREE.Vector3(), miradaObjetivoCamara = new THREE.Vector3();
var miradaActualCamara = new THREE.Vector3(), velocidadCamara = new THREE.Vector3();
var velocidadMiradaCamara = new THREE.Vector3(), aceleracionCamara = new THREE.Vector3();
var rigidezCamara = 35, amortiguacionCamara = 12;
// Camara estable: giro y seguimiento suavizados, sin efecto resorte.
var anguloCamaraSuave = 0;
var centroCamaraSuave = new THREE.Vector3();
var cubatas = [], zonasTermicas = [], lucesAnimadas = [];
var vasosRecogidos = 0, copasRecogidas = 0, puntos = 0;
var hielo = 100;
var tiempoJuego = 0, proximaAparicion = 0;
var puntosAparicion = [], avisoFase;
var estado = 'jugando', hud, mensajeFinal, indicadorZona;
var materialHielo;
var obstaculosMoviles = [];
var clientesAnimados = [];
// Configurar antes de ejecutar loadScene(), que crea el publico.
var TOTAL_BAILARINES = 30;
var TOTAL_CAMINANTES = 15;
var animacionesMixamo = {};
var cargadorFBX = null;
var colisionesEstaticas = [];
var colisionesDinamicas = [];
var fpsMonitor = null;
// Musica opcional: coloca musica.mp3 junto a lastice.html.
var musicaDiscoteca = null;
var radioChoquePublico = 1.05;
var ultimoEmpujon = -100;

var tiempoUltimoGolpe = -100;
// Los focos azules frenan el deshielo, pero nunca lo detienen.
var DESHIELO_BASE = 0.38, DESHIELO_FRIO = 0.14, DESHIELO_CALOR = 2.5;
var penalizacionGolpe = 12;
// Foco verde: inmoviliza durante tres segundos al entrar en su zona.
var tiempoParalizado = 0;
var dentroFocoVerde = false;
var inmunidadFocoVerde = 0; // Evita encadenar parálisis al salir y volver a entrar

init();
loadScene();
crearInterfaz();
reiniciarJuego();
crearPantallaInicio();
render();

function init() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.shadowMap.enabled = false; // Evita renderizar varias veces cada FBX animado
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;

    document.getElementById('container').appendChild(renderer.domElement);
    if(typeof Stats==='function') {
        fpsMonitor=new Stats();fpsMonitor.showPanel(0);
        document.body.appendChild(fpsMonitor.dom);
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x100d21);
    scene.fog = new THREE.Fog(0x100d21, 75, 220);

    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 400);
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
        if (!partidaIniciada) return;

        if (event.code === 'Space' || event.key.indexOf('Arrow') === 0) {
            event.preventDefault();
        }

        if (k === 'q' && !event.repeat) {
            salirAlMenu();
            return;
        }
        if (k === 'c' && !event.repeat) cambiarCamara();
        if (k === 'r' && !event.repeat) reiniciarJuego();

        if (event.code === 'Space' && !event.repeat && estado === 'jugando' && enSuelo && tiempoParalizado <= 0) {
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
    m.castShadow = false;
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
    scene.background = new THREE.Color(0x090b1c);
    scene.fog = new THREE.Fog(0x090b1c, 55, 135);
    // Luz ambiente muy tenue: conserva siluetas visibles sin iluminar
    // uniformemente toda la discoteca.
    scene.add(new THREE.HemisphereLight(0x7993c9, 0x100818, 0.32));
    var luzGeneral = new THREE.DirectionalLight(0x9caad6, 0.14);
    luzGeneral.position.set(-20, 38, 18); scene.add(luzGeneral);
    var metal=material(0x40485d), azul=material(0x21516b), rosa=material(0x79456f);
    var neonAzul=new THREE.MeshBasicMaterial({color:0x4de5ff});
    var neonRosa=new THREE.MeshBasicMaterial({color:0xff58b3});
    function luz(x,y,z,color) {
        var l=new THREE.PointLight(color,1.1,19,2);
        l.position.set(x,y,z); scene.add(l);
        lucesAnimadas.push({luz:l,fase:lucesAnimadas.length,base:1.1});
    }
    function cartel(texto,x,z,color) {
        var cv=document.createElement('canvas');cv.width=512;cv.height=128;
        var c=cv.getContext('2d');c.fillStyle=color;c.font='bold 52px Arial';
        c.textAlign='center';c.textBaseline='middle';c.fillText(texto,256,64);
        var m=new THREE.Mesh(new THREE.PlaneGeometry(19,4.75),
            new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv),transparent:true,side:THREE.DoubleSide}));
        m.position.set(x,7,z);scene.add(m);
    }
    function cilindro(x,y,z,r,h,color) {
        var m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,12),material(color));
        m.position.set(x,y,z);scene.add(m);return m;
    }
    function sofa(x,z,miraHaciaPositivoZ,color) {
        var g=new THREE.Group();g.position.set(x,0,z);
        // Asiento hacia el centro de la mesa.
        g.rotation.y=miraHaciaPositivoZ?Math.PI:0;
        caja(0,0.65,0,5.2,1.1,1.8,material(color),g);
        caja(0,1.25,0.75,5.2,2.1,0.5,material(color),g);
        caja(-2.45,1.05,0,0.4,1.6,2.2,material(color),g);
        caja(2.45,1.05,0,0.4,1.6,2.2,material(color),g);
        scene.add(g);
        // Colisión sencilla, no por cada triángulo.
        obstaculo(x,z,5.3,1.4,2.3,color,false).visible=false;
    }
    function conjuntoPub(x,z,color) {
        sofa(x,z-3.0,true,color);
        sofa(x,z+3.0,false,color);
        obstaculo(x,z,2.8,0.85,2.0,0x52697d,false);
        caja(x,0.91,z,3.1,0.12,2.3,material(0xa5cad5));
        for(var k=-1;k<=1;k++) cilindro(x+k*0.7,1.1,z,0.19,0.35,[0xff85a5,0x75ddff,0xffca70][k+1]);
    }
    function mesaAlta(x,z) {
        cilindro(x,0.8,z,0.24,1.6,0x51556b);
        cilindro(x,1.68,z,1.35,0.18,0x65859a);
        // Colisión para el tablero y para los taburetes.
        obstaculo(x,z,2.8,1.7,2.8,0x53657c,false).visible=false;
        for(var k=0;k<3;k++) {
            var a=k*2*Math.PI/3,px=x+Math.cos(a)*2.45,pz=z+Math.sin(a)*2.45;
            cilindro(px,0.68,pz,0.14,1.35,0x55576a);
            caja(px,1.4,pz,1.1,0.18,1.1,rosa);
            obstaculo(px,pz,1.1,1.4,1.1,0x55576a,false).visible=false;
        }
    }
    function planta(x,z) {
        obstaculo(x,z,1.4,1.1,1.4,0x4a4b5c,false);
        var verde=material(0x3a8b72);
        for(var k=0;k<3;k++) {
            var m=new THREE.Mesh(new THREE.ConeGeometry(0.9-k*0.15,1.7,7),verde);
            m.position.set(x,1.8+k*0.55,z);scene.add(m);
        }
    }
    // Tres zonas contiguas: barra al norte, pista central y pub al sur.
    var suelo=caja(0,-0.5,0,anchoMundo,1,fondoMundo,material(0x171629));
    objetosSuelo.push(suelo);
    var pared=material(0x252945,{transparent:true,opacity:0.09,depthWrite:false,side:THREE.DoubleSide});
    caja(0,8,-37.5,70,16,0.2,pared);caja(0,8,37.5,70,16,0.2,pared);
    caja(-35,8,0,0.2,16,75,pared);caja(35,8,0,0.2,16,75,pared);
    // BAR: zona norte, barra y mesas de clientes.
    caja(0,0.03,-27.5,68,0.06,19,material(0x1c4357));
    obstaculo(0,-32,43,2.1,2.5,0x2c6179,false);
    caja(0,2.2,-32,43.5,0.18,2.9,material(0xb3d8e6));
    caja(0,1.0,-30.7,42,0.12,0.08,neonAzul);
    for(var n=0;n<3;n++) caja(0,2.6+n*1.5,-36.2,41,0.2,1.5,metal);
    for(var k=0;k<48;k++) cilindro(-19+(k%16)*2.5,3.15+Math.floor(k/16)*1.5,-36.1,0.24,0.9,
        [0x6adfff,0xff8cbe,0xffd280,0x83edc2][k%4]);
    for(var t=0;t<8;t++) {
        var tx=-18+t*5.1;
        cilindro(tx,0.75,-28.3,0.13,1.5,0x555a70);
        caja(tx,1.56,-28.3,1.5,0.18,1.5,rosa);
        obstaculo(tx,-28.3,1.5,1.55,1.5,0x555a70,false).visible=false;
    }
    obstaculo(-29,-34,3,3.2,3,0x6fb8d3,false);
    cartel('LAST ICE BAR',0,-35.5,'#75e9ff');
    mesaAlta(-24,-22);mesaAlta(-11,-22);mesaAlta(12,-22);mesaAlta(25,-22);
    luz(0,9,-28,0x35cfff);
    // PISTA CENTRAL: espacio despejado para bailar y recoger vasos.
    var colores=[0x284b7e,0x56367f,0x723a71,0x2c6877,0x3c4f91];
    for(var i=0;i<12;i++) for(var j=0;j<8;j++) {
        var col=colores[(i+j)%colores.length];
        caja(-27.5+i*5,0.045,-15.5+j*4.3,4.7,0.08,4.0,
            material(col,{emissive:col,emissiveIntensity:0.34}));
    }
    [[-31,-17],[31,-17],[-31,18],[31,18]].forEach(function(p,i){
        obstaculo(p[0],p[1],1.6,7,1.6,0x34354b,false);
        caja(p[0],3.8,p[1]+0.84,0.14,6.5,0.08,i%2?neonAzul:neonRosa);
    });
    for(var f=0;f<6;f++) {
        var fx=-20+(f%3)*20,fz=-8+Math.floor(f/3)*15;
        caja(fx,10,fz,1.5,0.3,1.5,f%2?neonAzul:neonRosa);
        luz(fx,9,fz,f%2?0x44cfff:0xff65b8);
    }
    // DJ en el extremo de la pista, sin sala separada.
    obstaculo(0,18,15,2.5,2.7,0x42304e,false);
    caja(0,2.63,18,15.3,0.14,3.0,material(0x1c2030));
    for(var d=-1;d<=1;d+=2) {
        cilindro(d*4,2.8,18,1.15,0.12,0x14172a);
        obstaculo(d*10,18,2.5,5.5,2.5,0x171827,false);
    }
    // Cartel DJ eliminado a petición del usuario.
    // PUB / CHILL: sofás frente a mesas bajas, sin huecos excesivos.
    caja(0,0.03,28.8,68,0.06,16.5,material(0x204a4c));
    conjuntoPub(-24,28,0x568e88);
    conjuntoPub(-8,28,0x497f83);
    conjuntoPub(8,28,0x598c8c);
    conjuntoPub(24,28,0x467f7e);
    // Cartel Chill eliminado a petición del usuario.
    planta(-32,-20);planta(32,-20);planta(-32,34);planta(32,34);
    luz(0,8,29,0x55eac9);
    // Temperaturas y peligros, accesibles en las tres zonas.
    // Más focos rojos que azules: 7 rojos, 4 azules y 1 verde.
    for (var fz=0; fz<4; fz++) {
        crearZona(-23+fz*15,-11,4.4,'fria',fz);
    }
    for (var fr=0; fr<7; fr++) {
        crearZona(-25+(fr%4)*16, -12+Math.floor(fr/4)*23,
                  4.4,'caliente',fr+4);
    }
    // Foco verde pequeño y rápido, recorre toda la discoteca.
    crearZona(0,0,2.2,'paralizante',11);
    // Sin cubos móviles: los personajes animados llenan la pista.
    // Puntos repartidos entre bar, pista y pub, evitando el mobiliario.
    puntosAparicion=[];
    for(var xx=-29;xx<=29;xx+=6) for(var zz=-29;zz<=34;zz+=6)
        puntosAparicion.push([xx,zz]);
    crearPersonaje();
    // Guardar cajas estáticas una sola vez, antes de cargar personajes.
    prepararColisionesEstaticas();
    prepararClientesMixamo();
    // El antiguo modelo boy permanece desactivado (T-pose).
    // cargarModelo('models/boy/scene.gltf', 0, -20, 2.4, 1, 0);
    if(typeof THREE.GLTFLoader==='function') {
        cargarModelo('models/latas/scene.gltf',0,-32,0.7,1,0,2.4);
        // El mobiliario GLTF es decorativo; sus zonas ya tienen colisión simplificada.
    }
}

// Volúmenes AABB estáticos: se calculan una vez, no en cada frame.
function prepararColisionesEstaticas() {
    grupoObstaculos.updateMatrixWorld(true);
    colisionesEstaticas=grupoObstaculos.children.filter(function(m){
        return m.isMesh && !obstaculosMoviles.some(function(o){return o.m===m;});
    }).map(function(m){return new THREE.Box3().setFromObject(m);});
}

// Colisiones circulares de clientes, sin recorrer los triángulos del FBX.
function colisionaCliente(x,z) {
    // No bloqueamos el movimiento: la colision se resuelve empujando al hielo.
    return false;
}

function crearZona(x, z, radio, tipo, indice) {
    // El cono del foco delimita la zona térmica: sin discos ni aros dibujados.
    // La huella sobre el suelo tiene radio = altura * tan(angulo).
    var color = tipo === 'fria' ? 0x0066ff : tipo === 'paralizante' ? 0x00ff38 : 0xff1028;
    var alturaFoco = 13;
    var angulo = Math.atan(radio / alturaFoco);
    var foco = new THREE.SpotLight(color, tipo === 'paralizante' ? 20 : 14, 18, angulo, 0.06, 1.25);
    foco.position.set(x, alturaFoco, z);
    foco.castShadow = false;
    var objetivo = new THREE.Object3D();
    objetivo.position.set(x, 0, z);
    scene.add(objetivo);
    foco.target = objetivo;
    scene.add(foco);

    zonasTermicas.push({x:x,z:z,radio:radio,tipo:tipo,
        foco:foco,objetivo:objetivo,
        indice:indice,baseX:x,baseZ:z});
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

function crearCubata(x, z, altura, tipo, duracionVida) {
    tipo = tipo || 'vaso';
    var g = new THREE.Group();
    var vidrio = material(tipo === 'copa' ? 0xffd9ee : 0xb7edff, {
        transparent:true,opacity:0.65,roughness:0.1,side:THREE.DoubleSide,depthWrite:false
    });
    if (tipo === 'copa') {
        // Copa de cóctel: cáliz cónico, tallo y pie.
        var caliz=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.12,0.65,24,1,true),vidrio);
        caliz.position.y=1.08;g.add(caliz);
        var bebida=new THREE.Mesh(new THREE.CylinderGeometry(0.48,0.16,0.32,24),
            material(0xff67ad,{transparent:true,opacity:0.85}));
        bebida.position.y=1.19;g.add(bebida);
        var tallo=new THREE.Mesh(new THREE.CylinderGeometry(0.065,0.065,0.65,12),vidrio);
        tallo.position.y=0.43;g.add(tallo);
        var pie=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,0.08,24),vidrio);
        pie.position.y=0.08;g.add(pie);
    } else {
        var vaso=new THREE.Mesh(new THREE.CylinderGeometry(0.43,0.33,0.92,24,1,true),vidrio);
        vaso.position.y=0.55;g.add(vaso);
        var liquido=new THREE.Mesh(new THREE.CylinderGeometry(0.37,0.31,0.53,24),
            material(0xffb453,{transparent:true,opacity:0.8}));
        liquido.position.y=0.37;g.add(liquido);
        var pajita=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,1.2,8),
            material(0xff55b5));
        pajita.position.set(0.17,1,0);pajita.rotation.z=0.2;g.add(pajita);
    }
    var halo=new THREE.Mesh(new THREE.TorusGeometry(0.76,0.045,8,36),
        new THREE.MeshBasicMaterial({color:tipo==='copa'?0xff80c9:0xffdb77}));
    halo.rotation.x=Math.PI/2;halo.position.y=0.12;g.add(halo);
    g.scale.setScalar(0.8); // Vasos y copas un 20% mas pequenos
    g.position.set(x,altura||0,z);scene.add(g);
    cubatas.push({grupo:g,x:x,z:z,altura:altura||0,tipo:tipo,
        halo:halo,recogido:false,expira:tiempoJuego+duracionVida});
}

function eliminarBebida(c) {
    scene.remove(c.grupo);
    c.grupo.traverse(function(o){
        if(o.geometry) o.geometry.dispose();
        // No liberar materiales compartidos por otros objetos.
    });
    var i=cubatas.indexOf(c);
    if(i>=0) cubatas.splice(i,1);
}

function puntoValidoBebida(x,z) {
    if(Math.abs(x)>anchoMundo/2-2 || Math.abs(z)>fondoMundo/2-2) return false;
    if(Math.hypot(personaje.position.x-x,personaje.position.z-z)<3) return false;
    if(cubatas.some(function(c){return Math.hypot(c.x-x,c.z-z)<2.8;})) return false;
    if(colisionaCliente(x,z)) return false;
    var candidato=new THREE.Box3(new THREE.Vector3(x-0.8,0.1,z-0.8),
        new THREE.Vector3(x+0.8,1.5,z+0.8));
    for(var i=0;i<colisionesEstaticas.length;i++)
        if(candidato.intersectsBox(colisionesEstaticas[i])) return false;
    return true;
}

function aparecerBebida() {
    var disponibles=puntosAparicion.filter(function(p){return puntoValidoBebida(p[0],p[1]);});
    if(!disponibles.length) return false;
    var p=disponibles[Math.floor(Math.random()*disponibles.length)];
    var tipo=Math.random()<0.16?'copa':'vaso'; // Copas raras (16 %)
    crearCubata(p[0],p[1],0,tipo,16+Math.random()*11);
    return true;
}

function actualizarBebidas(delta) {
    tiempoJuego+=delta;
    cubatas.slice().forEach(function(c){
        if(tiempoJuego>=c.expira) eliminarBebida(c);
    });
    if(tiempoJuego>=proximaAparicion && cubatas.length<13) {
        for(var n=0;n<3 && cubatas.length<13;n++) aparecerBebida();
        proximaAparicion=tiempoJuego+1.5+Math.random()*1.3;
    }
}

function iniciarFase2() {
    // Compatibilidad: ya no existen rondas en el modo de puntuación.
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

    avisoFase = document.createElement('div');
    avisoFase.style.cssText = 'position:fixed;top:15%;left:50%;transform:translateX(-50%);' +
        'padding:18px 30px;background:rgba(18,15,43,.94);color:#7deaff;' +
        'border:2px solid #ff7bc6;border-radius:14px;font:bold 23px Arial;' +
        'z-index:30;pointer-events:none;display:none;text-align:center;';
    document.body.appendChild(avisoFase);

    actualizarHUD('');
}

function actualizarHUD(zona) {
    if (!hud) return;
    var color = hielo < 30 ? '#ff6a77' : '#65e0ff';
    hud.innerHTML =
        '<span>⭐ PUNTOS: ' + puntos + '</span>' +
        '<span>🥤 ' + vasosRecogidos + ' × 1</span>' +
        '<span>🍸 ' + copasRecogidas + ' × 5</span>' +
        '<span>' + (zona==='paralizado'?'🟢 PARALIZADO '+tiempoParalizado.toFixed(1)+'s':zona==='fria'?'❄️ FRÍO':zona==='caliente'?'🔥 CALOR':'🧊 HIELO') + '</span>' +
        '<div class="bar"><div class="fill" style="width:' + hielo +
        '%;background:' + color + '"></div></div>' +
        '<span>' + Math.ceil(hielo) + '%</span>';
}


function reiniciarJuego() {
    if (!personaje) return;

    personaje.position.set(0, 0, -24);
    personaje.rotation.set(0, 0, 0);
    personaje.scale.set(1, 1, 1);

    velocidadVertical = 0;
    enSuelo = true;
    tiempoUltimoGolpe = -100;

    hielo = 100;
    tiempoParalizado = 0;
    dentroFocoVerde = false;
    inmunidadFocoVerde = 0;
    vasosRecogidos = 0;
    copasRecogidas = 0;
    puntos = 0;
    tiempoJuego = 0;
    reiniciarClientesMixamo();
    proximaAparicion = 2.2;
    if(avisoFase) avisoFase.style.display='none';
    estado = 'jugando';
    teclas = {};

    cubatas.slice().forEach(eliminarBebida);
    for(var i=0;i<9;i++) aparecerBebida();

    if (mensajeFinal) {
        mensajeFinal.style.display = 'none';
    }

    modoCamara = 0;
    camaraIniciada = false;
    cameraControls.enabled = false;

    actualizarHUD('');
}

// Q: salir de la partida al menú inicial (el navegador no permite cerrar
// de forma fiable una pestaña que el usuario ha abierto manualmente).
function salirAlMenu() {
    partidaIniciada = false;
    estado = 'menu';
    teclas = {};
    tiempoParalizado = 0;
    dentroFocoVerde = false;
    inmunidadFocoVerde = 0;
    if (mensajeFinal) mensajeFinal.style.display = 'none';
    if (pantallaInicio) pantallaInicio.style.display = 'flex';
    if (musicaDiscoteca) musicaDiscoteca.pause();
    cameraControls.enabled = false;
}

function terminarJuego(victoria) {
    if (estado !== 'jugando') return;
    estado = 'derrota';
    document.getElementById('lastice-titulo').textContent = 'FIN DE LA PARTIDA 🧊';
    document.getElementById('lastice-detalle').textContent =
        'Puntuación final: ' + puntos + ' puntos. ' +
        vasosRecogidos + ' vasos y ' + copasRecogidas + ' copas recogidas.';
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

function puedeMoverse(x,z) {
    if(colisionaCliente(x,z)) return false;
    var actual=cajaColision(personaje.position.x,personaje.position.z);
    var siguiente=cajaColision(x,z);
    // Static boxes cached, dynamic obstacles updated as they move.
    var cajas=colisionesEstaticas;
    for(var i=0;i<cajas.length+obstaculosMoviles.length;i++) {
        var cajaO=i<cajas.length ? cajas[i] :
            new THREE.Box3().setFromObject(obstaculosMoviles[i-cajas.length].m);
        if(!siguiente.intersectsBox(cajaO)) continue;
        if(!actual.intersectsBox(cajaO)) return false;
        var a=actual.clone().intersect(cajaO).getSize(new THREE.Vector3());
        var b=siguiente.clone().intersect(cajaO).getSize(new THREE.Vector3());
        if(b.x*b.y*b.z>a.x*a.y*a.z+1e-7) return false;
    }
    return true;
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
    if (partidaIniciada && estado === 'jugando') {
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

        zonasTermicas.forEach(function(z) {
            if (z.tipo === 'paralizante') {
                // Recorrido amplio y mucho más rápido, no limitado a una zona.
                // Aproximadamente 2,5-3 veces la velocidad angular de los demás.
                var tg = tMov * 0.44;
                z.x = 24 * Math.sin(tg * 1.13 + 0.5);
                z.z = 26 * Math.sin(tg * 0.79 + 1.8);
            } else {
                // Trayectorias independientes para focos rojos y azules.
                var t = tMov * (0.13 + (z.indice%3)*0.035) * 1.15 + z.indice*1.3;
                z.x = THREE.MathUtils.clamp(z.baseX + 10*Math.sin(t), -29, 29);
                z.z = THREE.MathUtils.clamp(z.baseZ + 9*Math.cos(t*0.83), -28, 32);
            }
            z.objetivo.position.set(z.x, 0, z.z);
            // Desplazamos también el emisor: el cono permanece vertical y
            // su huella coincide con el radio de la zona térmica.
            z.foco.position.set(z.x, 13, z.z);
        });


        tiempoParalizado = Math.max(0, tiempoParalizado - delta);
        inmunidadFocoVerde = Math.max(0, inmunidadFocoVerde - delta);
        var dx = 0;
        var dz = 0;

        // Controles relativos a la pantalla, incluso cuando la camara gira.
        // La vista aerea mantiene los ejes tradicionales del escenario.
        var horizontal = (teclas['d'] || teclas['arrowright'] ? 1 : 0) -
                         (teclas['a'] || teclas['arrowleft'] ? 1 : 0);
        var vertical = (teclas['w'] || teclas['arrowup'] ? 1 : 0) -
                       (teclas['s'] || teclas['arrowdown'] ? 1 : 0);
        if (modoCamara === 0) {
            var frenteX = miradaActualCamara.x - camera.position.x;
            var frenteZ = miradaActualCamara.z - camera.position.z;
            var moduloFrente = Math.hypot(frenteX, frenteZ);
            if (moduloFrente < 0.001) {
                frenteX = -Math.sin(personaje.rotation.y);
                frenteZ = -Math.cos(personaje.rotation.y);
                moduloFrente = 1;
            }
            frenteX /= moduloFrente;
            frenteZ /= moduloFrente;
            // Vector derecho perpendicular al frente de la camara.
            dx = -frenteZ * horizontal + frenteX * vertical;
            dz =  frenteX * horizontal + frenteZ * vertical;
        } else {
            dx = horizontal;
            dz = -vertical;
        }

        if (tiempoParalizado > 0) { dx = 0; dz = 0; }
        var moviendo = dx !== 0 || dz !== 0;

        if (moviendo) {

            var len = Math.sqrt(dx * dx + dz * dz);
            dx /= len;
            dz /= len;

            var paso = velocidad * delta;

            var nuevoX = THREE.MathUtils.clamp(
                personaje.position.x + dx * paso,
                -anchoMundo / 2 + 1,
                anchoMundo / 2 - 1
            );

            if (puedeMoverse(nuevoX, personaje.position.z)) {
                personaje.position.x = nuevoX;
            }

            var nuevoZ = THREE.MathUtils.clamp(
                personaje.position.z + dz * paso,
                -fondoMundo / 2 + 1,
                fondoMundo / 2 - 1
            );

            if (puedeMoverse(personaje.position.x, nuevoZ)) {
                personaje.position.z = nuevoZ;
            }

            // El cubito mira hacia donde camina, tambien al pulsar S.
            // A/D siempre desplazan izquierda/derecha en pantalla.
            var objetivoAngulo = Math.atan2(dx, dz);
            var diferenciaAngulo = Math.atan2(
                Math.sin(objetivoAngulo - personaje.rotation.y),
                Math.cos(objetivoAngulo - personaje.rotation.y)
            );
            personaje.rotation.y += THREE.MathUtils.clamp(
                diferenciaAngulo, -delta * 10, delta * 10
            );

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
        var bajoFrio = false, bajoCalor = false, bajoVerde = false;
        zonasTermicas.forEach(function(z) {
            var d = Math.hypot(personaje.position.x-z.x,personaje.position.z-z.z);
            if(d < z.radio && personaje.position.y < 2) {
                if(z.tipo==='fria') bajoFrio = true;
                else if(z.tipo==='caliente') bajoCalor = true;
                else if(z.tipo==='paralizante') bajoVerde = true;
            }
        });
        // Solo activa el efecto al ENTRAR: no se reinicia continuamente.
        if (bajoVerde && !dentroFocoVerde && inmunidadFocoVerde <= 0) {
            tiempoParalizado = 3;
            inmunidadFocoVerde = 8; // 3 s paralizado + 5 s sin nuevas parálisis
        }
        dentroFocoVerde = bajoVerde;
        // El rojo prevalece si se solapan. El verde inmoviliza, no cambia el deshielo.
        zona = tiempoParalizado > 0 ? 'paralizado' :
               bajoCalor ? 'caliente' : bajoFrio ? 'fria' : '';
        var deshielo = bajoCalor ? DESHIELO_CALOR :
            bajoFrio ? DESHIELO_FRIO : DESHIELO_BASE;
        hielo -= deshielo * delta;

        hielo = THREE.MathUtils.clamp(hielo, 0, 100);

        var escala = 0.25 + 0.75 * hielo / 100;
        materialHielo.opacity = 0.35 + 0.49 * hielo / 100;
        personaje.scale.set(escala, escala, escala);

        actualizarBebidas(delta);
        cubatas.slice().forEach(function(c) {
            var distancia = Math.hypot(personaje.position.x-c.x, personaje.position.z-c.z);
            if(distancia<1.3 && Math.abs(personaje.position.y-c.altura)<0.8) {
                if(c.tipo==='copa') { copasRecogidas++; puntos+=5; }
                else { vasosRecogidos++; puntos+=1; }
                // Las bebidas puntúan; no recuperan hielo.
                eliminarBebida(c);
            }
        });

        if(hielo<=0) terminarJuego(false);
        actualizarHUD(zona);
    }

    var t = clock.elapsedTime;

    cubatas.forEach(function(c, i) {
        if (true) {
            c.grupo.rotation.y =
                Math.sin(t * 1.4 + i) * 0.18;

            c.halo.scale.setScalar(
                1 + 0.07 * Math.sin(t * 3 + i)
            );
        }
    });

    lucesAnimadas.forEach(function(l) {
        l.luz.intensity =
            l.base * (0.8 + 0.2 * Math.sin(t * 1.9 + l.fase));
    });


    actualizarClientesMixamo(delta);
    if (partidaIniciada && estado === 'jugando') resolverChoquesConPublico(delta);
    updateCamera(delta);
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
    if (modoCamara === 0) {
        // Suavizado independiente de los FPS, sin sobrepasar el objetivo.
        var suavizadoPosicion = 1 - Math.exp(-7 * delta);
        var suavizadoGiro = 1 - Math.exp(-2.2 * delta);
        var anguloDeseado = personaje.rotation.y;

        if (!camaraIniciada) {
            centroCamaraSuave.set(personaje.position.x, 0, personaje.position.z);
            anguloCamaraSuave = anguloDeseado;
            camaraIniciada = true;
        } else {
            centroCamaraSuave.x += (personaje.position.x - centroCamaraSuave.x) * suavizadoPosicion;
            centroCamaraSuave.z += (personaje.position.z - centroCamaraSuave.z) * suavizadoPosicion;
            // Diferencia angular mas corta, sin saltos al cruzar +/-PI.
            var diferencia = Math.atan2(
                Math.sin(anguloDeseado - anguloCamaraSuave),
                Math.cos(anguloDeseado - anguloCamaraSuave)
            );
            anguloCamaraSuave += diferencia * suavizadoGiro;
        }

        // Radio y altura constantes: no hay zoom ni rebotes al girar.
        var distancia = 10;
        camera.position.set(
            centroCamaraSuave.x - Math.sin(anguloCamaraSuave) * distancia,
            5.5,
            centroCamaraSuave.z - Math.cos(anguloCamaraSuave) * distancia
        );
        miradaActualCamara.set(centroCamaraSuave.x, 1, centroCamaraSuave.z);
        camera.lookAt(miradaActualCamara);
    } else {
        // Vista aerea estable y sin arrastre de la camara anterior.
        camera.position.set(0, 90, 48);
        miradaActualCamara.set(0, 0, 0);
        camera.lookAt(miradaActualCamara);
        camaraIniciada = false;
    }
}


function cambiarCamara() {
    modoCamara = (modoCamara + 1) % 2;
    cameraControls.enabled = false;
    // Evita que el resorte arrastre la camara desde la vista anterior.
    camaraIniciada = false;
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
    if (fpsMonitor) fpsMonitor.update();
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



// El publico es un obstaculo: si entra en contacto con el hielo,
// apartamos al hielo, NO al NPC. Sin atravesar paredes ni muebles.
function resolverChoquesConPublico(delta) {
    var px = personaje.position.x, pz = personaje.position.z;
    var empujeX = 0, empujeZ = 0;
    for (var i = 0; i < clientesAnimados.length; i++) {
        var npc = clientesAnimados[i].modelo.position;
        var dx = px - npc.x, dz = pz - npc.z;
        var d = Math.hypot(dx, dz);
        if (d >= radioChoquePublico) continue;
        if (d < 0.001) { dx = 1; dz = 0; d = 1; }
        var profundidad = radioChoquePublico - d;
        empujeX += dx / d * profundidad;
        empujeZ += dz / d * profundidad;
    }
    var longitud = Math.hypot(empujeX, empujeZ);
    if (longitud < 0.0001) return;
    // Empuje progresivo, con tope para evitar saltos al aparecer un NPC.
    var maxPaso = Math.min(longitud, 5 * delta);
    empujeX = empujeX / longitud * maxPaso;
    empujeZ = empujeZ / longitud * maxPaso;
    var nx = THREE.MathUtils.clamp(px + empujeX, -anchoMundo/2+1, anchoMundo/2-1);
    if (puedeMoverse(nx, pz)) personaje.position.x = nx;
    var nz = THREE.MathUtils.clamp(pz + empujeZ, -fondoMundo/2+1, fondoMundo/2-1);
    if (puedeMoverse(personaje.position.x, nz)) personaje.position.z = nz;
}

function iniciarMusicaDiscoteca() {
    if (!musicaDiscoteca) {
        musicaDiscoteca = new Audio('musica.mp3');
        musicaDiscoteca.loop = true;
        musicaDiscoteca.volume = 0.35;
        musicaDiscoteca.addEventListener('error', function() {
            console.warn('Musica no encontrada: coloca musica.mp3 junto a lastice.html');
        });
    }
    var reproduccion = musicaDiscoteca.play();
    if (reproduccion && reproduccion.catch) {
        reproduccion.catch(function(e) { console.warn('No se pudo reproducir la musica:', e); });
    }
}

function crearPantallaInicio() {

    pantallaInicio = document.createElement('div');
    pantallaInicio.id = 'pantalla-inicio';

    pantallaInicio.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(6, 8, 23, 0.94);
        color: white;
        font-family: Arial, sans-serif;
        text-align: center;
    `;

    pantallaInicio.innerHTML = `
        <div style="
            width: min(520px, 88vw);
            padding: 42px 35px;
            border: 2px solid #65e0ff;
            border-radius: 20px;
            background: #15162c;
            box-shadow: 0 0 50px #225d88;
        ">

            <h1 style="
                font-size: 64px;
                color: #65e0ff;
                margin: 0;
                text-shadow: 0 0 20px #32aaff;
            ">
                LAST ICE
            </h1>

            <h2 style="
                color: #ff78c4;
                font-size: 19px;
                margin: 12px 0 25px;
            ">
                SOBREVIVE Y PUNTÚA
            </h2>

            <p style="line-height: 1.7;">
                Eres un cubito de hielo perdido en una discoteca.
                ¡Recoge todas las bebidas que puedas antes de derretirte!<br>
                🥤 <b>Vasos: +1 punto</b> &nbsp; 🍸 <b>Copas: +5 puntos</b><br>
                Los focos <span style="color:#ff6078"><b>rojos</b></span> aceleran el deshielo;
                los <span style="color:#69baff"><b>azules</b></span> lo frenan,
                pero nunca lo detienen. El <span style="color:#36ff76"><b>verde</b></span>
                te paraliza durante 3 segundos. No hay tiempo límite: ¡bate tu récord!
            </p>

            <div style="
                margin: 25px 0;
                padding: 18px;
                background: #20243f;
                border-radius: 12px;
                line-height: 2;
            ">
                <b>WASD / Flechas</b> — Moverse<br>
                <b>ESPACIO</b> — Saltar<br>
                <b>C</b> — Cambiar cámara<br>
                <b>R</b> — Reiniciar<br>
                <b>Q</b> — Salir al menú<br>
            </div>

            <button id="boton-jugar" style="
                padding: 15px 55px;
                background: #65e0ff;
                color: #101426;
                border: none;
                border-radius: 12px;
                font-size: 22px;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 0 22px #2699d5;
            ">
                ▶ JUGAR
            </button>

        </div>
    `;

    document.body.appendChild(pantallaInicio);

    document.getElementById('boton-jugar')
        .addEventListener('click', function() {

            partidaIniciada = true;
            pantallaInicio.style.display = 'none';

            reiniciarJuego();
            iniciarMusicaDiscoteca(); // El clic permite iniciar audio en el navegador.
            clock.getDelta();
        });
}



function cargarModelo(ruta, x, z, altura, escala, rotacion, elevacion) {

    if (typeof THREE.GLTFLoader !== 'function') return;
    var loader = new THREE.GLTFLoader();

    loader.load(
        ruta,

        function(gltf) {

            var modelo = gltf.scene;

            // Centramos el modelo horizontalmente.
            modelo.updateMatrixWorld(true);

            var cajaModelo = new THREE.Box3().setFromObject(modelo);
            var centro = cajaModelo.getCenter(new THREE.Vector3());
            var dimensiones = cajaModelo.getSize(new THREE.Vector3());

            if (dimensiones.y === 0) return;

            // Normalizamos el tamaño para que no aparezcan
            // modelos gigantes o diminutos.
            var factor = altura / dimensiones.y;
            modelo.scale.multiplyScalar(factor * escala);

            modelo.updateMatrixWorld(true);

            cajaModelo.setFromObject(modelo);
            centro = cajaModelo.getCenter(new THREE.Vector3());

            modelo.position.x += x - centro.x;
            modelo.position.z += z - centro.z;
            modelo.position.y += (elevacion || 0) - cajaModelo.min.y;

            modelo.rotation.y += rotacion || 0;

            modelo.traverse(function(obj) {
                if (obj.isMesh) {
                    obj.castShadow = false;
                    obj.receiveShadow = true;
                }
            });

            scene.add(modelo);
        },

        undefined,

        function(error) {
            console.error('Error cargando modelo:', ruta, error);
        }
    );
}


// ===== MULTITUD LIGERA: PERSONAJES 3D SIN FBX =====
// 24 bailarines + 12 caminantes. Geometrias compartidas, sin esqueletos.
var geometriasPublico = null;

function geometriaPublico() {
    if (geometriasPublico) return geometriasPublico;
    geometriasPublico = {
        cabeza: new THREE.SphereGeometry(0.31, 10, 8),
        pelo: new THREE.SphereGeometry(0.325, 10, 7),
        torso: new THREE.BoxGeometry(0.75, 0.95, 0.39),
        brazo: new THREE.BoxGeometry(0.21, 0.78, 0.23),
        pierna: new THREE.BoxGeometry(0.27, 0.88, 0.3),
        ojo: new THREE.SphereGeometry(0.038, 6, 4)
    };
    return geometriasPublico;
}

function crearFiguraPublico(indice) {
    var g = geometriaPublico();
    var piel = [0xf0bd91,0xc7865c,0x8d583f,0xe5ae8b,0xb87856][indice%5];
    var ropa = [0xff6dba,0x53d8ed,0xffcc70,0x9e8cff,0x6fdfad,0xf28472][indice%6];
    var pantalon = [0x26334d,0x443454,0x1d4956,0x444b6a][indice%4];
    var cabello = [0x241c27,0x51342a,0xd9b06c,0x6a354e][indice%4];
    function pieza(geo, color, padre, x,y,z) {
        var m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({color:color}));
        m.position.set(x,y,z); padre.add(m); return m;
    }
    var raiz = new THREE.Group();
    var cuerpo = new THREE.Group(); raiz.add(cuerpo);
    pieza(g.torso, ropa, cuerpo, 0,1.45,0);
    pieza(g.cabeza, piel, cuerpo, 0,2.25,0);
    // Casquete de pelo discreto, sin aspecto de gorra voluminosa.
    // Casquete esferico: sigue la cabeza y evita la zona calva.
    // Parte frontal corta para no tapar los ojos.
    var casquete = new THREE.SphereGeometry(0.326, 16, 12,
                                           0, Math.PI * 2, 0, 1.35);
    pieza(casquete, cabello, cuerpo, 0, 2.25, 0);

    // Pelo posterior algo mas largo: cubre la nuca sin formar un casco.
    // La mitad posterior de la esfera corresponde a Z negativo.
    var nuca = new THREE.SphereGeometry(0.327, 16, 10,
                                        Math.PI, Math.PI, 1.32, 0.68);
    pieza(nuca, cabello, cuerpo, 0, 2.25, 0);

    // Mitad pelo corto, mitad coleta baja y fina.
    // Los ojos miran hacia +Z, así que la coleta cae hacia -Z.
    if (indice % 2 === 1) {
        // Un único mechón continuo, afinado hacia la punta.
        // La curva evita el aspecto de cilindro o salchicha pegada.
        var curvaColeta = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 2.43, -0.31),
            new THREE.Vector3(0, 2.37, -0.40),
            new THREE.Vector3(0, 2.23, -0.44),
            new THREE.Vector3(0, 2.08, -0.43)
        ]);
        var geometriaColeta = new THREE.TubeGeometry(curvaColeta, 12, 0.065, 7, false);
        pieza(geometriaColeta, cabello, cuerpo, 0, 0, 0);
        // Punta pequeña y orientada hacia abajo.
        var puntaColeta = pieza(new THREE.ConeGeometry(0.064, 0.14, 7),
                                cabello, cuerpo, 0, 2.045, -0.43);
        puntaColeta.rotation.z = Math.PI;
    }
    pieza(g.ojo,0x161628,cuerpo,-0.12,2.27,0.293);
    pieza(g.ojo,0x161628,cuerpo,0.12,2.27,0.293);
    var brazoI = new THREE.Group(); brazoI.position.set(-0.48,1.85,0); cuerpo.add(brazoI);
    pieza(g.brazo,ropa,brazoI,0,-0.39,0);
    var brazoD = new THREE.Group(); brazoD.position.set(0.48,1.85,0); cuerpo.add(brazoD);
    pieza(g.brazo,ropa,brazoD,0,-0.39,0);
    var piernaI = new THREE.Group(); piernaI.position.set(-0.21,0.99,0); cuerpo.add(piernaI);
    pieza(g.pierna,pantalon,piernaI,0,-0.45,0);
    var piernaD = new THREE.Group(); piernaD.position.set(0.21,0.99,0); cuerpo.add(piernaD);
    pieza(g.pierna,pantalon,piernaD,0,-0.45,0);
    var escala = 1.18 + (indice%5)*0.075; // Publico mas alto, proporcionado a las mesas
    raiz.scale.setScalar(escala);
    raiz.userData.partes = {cuerpo:cuerpo, brazoI:brazoI, brazoD:brazoD, piernaI:piernaI, piernaD:piernaD};
    return raiz;
}

function puntoLibrePublico(x, z, radio) {
    return true;
}

// Movimiento libre del publico: solo limites por zonas, sin colisiones con muebles.
// Los bailarines se desplazan suavemente por la pista; los paseantes cambian de rumbo.
function destinoPublico(c) {
    var x, z;
    if (c.tipo === 'baile') {
        x = THREE.MathUtils.clamp(c.modelo.position.x + (Math.random()-0.5)*7, -26, 26);
        z = THREE.MathUtils.clamp(c.modelo.position.z + (Math.random()-0.5)*6, -14, 12);
    } else {
        // Paseos libres dentro de la zona norte (bar) o sur (chill).
        x = -29 + Math.random()*58;
        z = c.zona === 'bar' ? -25 + Math.random()*5 : 23 + Math.random()*11;
    }
    c.destinoX = x;
    c.destinoZ = z;
    c.espera = 0.4 + Math.random()*1.5;
}

function prepararClientesMixamo() {
    clientesAnimados.length = 0;
    for (var i = 0; i < TOTAL_BAILARINES; i++) {
        // Posiciones aleatorias en la pista, sin cuadrícula.
        var x = -25 + Math.random()*50;
        var z = -14 + Math.random()*26;
        var figura = crearFiguraPublico(i);
        figura.position.set(x, 0, z);
        figura.rotation.y = Math.random()*Math.PI*2;
        scene.add(figura);
        var c = {
            modelo: figura, tipo: 'baile',
            fase: Math.random()*Math.PI*2,
            ritmo: 2.3 + Math.random()*1.5,
            inicio: [x,z], orientacion: figura.rotation.y,
            velocidad: 0.3 + Math.random()*0.35,
            destinoX: x, destinoZ: z, espera: Math.random()*3
        };
        clientesAnimados.push(c);
    }
    for (var j = 0; j < TOTAL_CAMINANTES; j++) {
        var zona = j < TOTAL_CAMINANTES/2 ? 'bar' : 'chill';
        var x = -27 + Math.random()*54;
        var z = zona === 'bar' ? -25 + Math.random()*5 : 23 + Math.random()*11;
        var figura = crearFiguraPublico(j + TOTAL_BAILARINES);
        figura.position.set(x, 0, z);
        figura.rotation.y = Math.random()*Math.PI*2;
        scene.add(figura);
        var c = {
            modelo: figura, tipo: 'paseo', zona: zona,
            fase: Math.random()*Math.PI*2, ritmo: 6 + Math.random()*2,
            inicio: [x,z], orientacion: figura.rotation.y,
            velocidad: 1.0 + Math.random()*0.65,
            destinoX: x, destinoZ: z, espera: Math.random()*2
        };
        clientesAnimados.push(c);
    }
    console.log('PUBLICO LAST ICE:', TOTAL_BAILARINES,
        'bailarines,', TOTAL_CAMINANTES, 'caminantes.');
}

function actualizarClientesMixamo(delta) {
    if (!partidaIniciada || estado !== 'jugando') return;
    clientesAnimados.forEach(function(c) {
        var p = c.modelo.userData.partes;
        c.fase += delta*c.ritmo;
        var s = Math.sin(c.fase), s2 = Math.sin(c.fase*0.5);

        // Moverse hacia un destino aleatorio y elegir otro al alcanzarlo.
        var dx = c.destinoX - c.modelo.position.x;
        var dz = c.destinoZ - c.modelo.position.z;
        var distancia = Math.hypot(dx,dz);
        var caminando = false;
        if (c.espera > 0) {
            c.espera -= delta;
        } else if (distancia < 0.4) {
            destinoPublico(c);
        } else {
            var paso = Math.min(distancia, c.velocidad*delta);
            c.modelo.position.x += dx/distancia*paso;
            c.modelo.position.z += dz/distancia*paso;
            // Giro gradual hacia la dirección de movimiento.
            var angulo = Math.atan2(dx,dz);
            var diferencia = Math.atan2(Math.sin(angulo-c.modelo.rotation.y),
                                        Math.cos(angulo-c.modelo.rotation.y));
            c.modelo.rotation.y += THREE.MathUtils.clamp(diferencia, -delta*3, delta*3);
            caminando = true;
        }

        // Separación suave: los NPC se apartan del cubito, sin bloquearlo.
        var px = c.modelo.position.x-personaje.position.x;
        var pz = c.modelo.position.z-personaje.position.z;
        var separacion = Math.hypot(px,pz);
        if (separacion < 1.7) {
            if (separacion < 0.001) {px=1;pz=0;separacion=1;}
            var empuje = Math.min(1.7-separacion, delta*5);
            c.modelo.position.x += px/separacion*empuje;
            c.modelo.position.z += pz/separacion*empuje;
        }
        if (c.tipo === 'baile') {
            p.cuerpo.position.y = 0.07*Math.abs(s);
            p.cuerpo.rotation.z = 0.11*s;
            p.cuerpo.rotation.y = 0.13*s2;
            p.brazoI.rotation.z = -0.55-0.6*Math.sin(c.fase+0.6);
            p.brazoD.rotation.z = 0.55+0.6*Math.sin(c.fase+1.8);
            p.brazoI.rotation.x = 0.35*Math.cos(c.fase);
            p.brazoD.rotation.x = -0.35*Math.cos(c.fase);
            p.piernaI.rotation.x = 0.25*s;
            p.piernaD.rotation.x = -0.25*s;
        } else {
            p.cuerpo.position.y = caminando ? 0.025*Math.abs(s) : 0;
            p.brazoI.rotation.x = caminando ? 0.48*s : 0;
            p.brazoD.rotation.x = caminando ? -0.48*s : 0;
            p.piernaI.rotation.x = caminando ? -0.48*s : 0;
            p.piernaD.rotation.x = caminando ? 0.48*s : 0;
        }
    });
}

function reiniciarClientesMixamo() {
    clientesAnimados.forEach(function(c) {
        c.modelo.position.set(c.inicio[0],0,c.inicio[1]);
        c.modelo.rotation.y = c.orientacion;
        c.fase = Math.random()*Math.PI*2;
        c.destinoX = c.inicio[0];
        c.destinoZ = c.inicio[1];
        c.espera = Math.random()*2;
    });
}
