

/* LAST ICE - Supervivencia 
   Controles: WASD/flechas mover, ESPACIO saltar, C camara, R reiniciar. */

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
var modoCamara = 0; // 0 TRON, 1 elevada, 2 panorámica
var camaraIniciada = false;
var posicionObjetivoCamara = new THREE.Vector3(), miradaObjetivoCamara = new THREE.Vector3();
var miradaActualCamara = new THREE.Vector3(), velocidadCamara = new THREE.Vector3();
var velocidadMiradaCamara = new THREE.Vector3(), aceleracionCamara = new THREE.Vector3();
var rigidezCamara = 35, amortiguacionCamara = 12;
var cubatas = [], zonasTermicas = [], lucesAnimadas = [];
var vasosRecogidos = 0, copasRecogidas = 0, objetivoVasos = 15;
var fase = 1, objetivoFase2 = 30, hielo = 100, duracion = 300, tiempoRestante = duracion;
var tiempoJuego = 0, proximaAparicion = 0, avisoFaseHasta = 0;
var puntosAparicion = [], avisoFase;
var estado = 'jugando', hud, mensajeFinal, indicadorZona;
var materialHielo;
var obstaculosMoviles = [];
var clientesAnimados = [];
var animacionesMixamo = {};
var cargadorFBX = null;
var colisionesEstaticas = [];
var colisionesDinamicas = [];
var fpsMonitor = null;

var tiempoUltimoGolpe = -100;
var penalizacionGolpe = 12;

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
    scene.add(new THREE.HemisphereLight(0x9bc8ff, 0x302040, 1.8));
    var luzGeneral = new THREE.DirectionalLight(0xffffff, 0.65);
    luzGeneral.position.set(-20, 38, 18); scene.add(luzGeneral);
    var metal=material(0x40485d), azul=material(0x21516b), rosa=material(0x79456f);
    var neonAzul=new THREE.MeshBasicMaterial({color:0x4de5ff});
    var neonRosa=new THREE.MeshBasicMaterial({color:0xff58b3});
    function luz(x,y,z,color) {
        var l=new THREE.PointLight(color,1.9,23,2);
        l.position.set(x,y,z); scene.add(l);
        lucesAnimadas.push({luz:l,fase:lucesAnimadas.length,base:1.9});
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
    crearZona(-29,-33,3,'fria');crearZona(29,32,3,'fria');
    crearZona(-27,30,3,'fria');
    crearZona(-9,-5,3.4,'caliente');crearZona(14,8,3.4,'caliente');
    crearObstaculoMovil(-5,3,3,0,0.85);
    crearObstaculoMovil(12,-9,0,2.5,0.7);
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
    for(var i=0;i<clientesAnimados.length;i++) {
        var c=clientesAnimados[i];
        if(Math.hypot(x-c.modelo.position.x,z-c.modelo.position.z)<1.12) return true;
    }
    return false;
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
    var tipo=fase===2 && Math.random()<0.48?'copa':'vaso';
    var vida=fase===1 ? 10+Math.random()*5 : 6+Math.random()*5;
    crearCubata(p[0],p[1],0,tipo,vida);
    return true;
}

function actualizarBebidas(delta) {
    tiempoJuego+=delta;
    cubatas.slice().forEach(function(c){
        if(tiempoJuego>=c.expira) eliminarBebida(c);
    });
    var maximo=fase===1?10:15;
    if(tiempoJuego>=proximaAparicion && cubatas.length<maximo) {
        // Generar pequeños grupos para mantener la pista poblada.
        for(var n=0;n<3 && cubatas.length<maximo;n++) aparecerBebida();
        proximaAparicion=tiempoJuego+(fase===1?2+Math.random()*2:1+Math.random()*2);
    }
}

function iniciarFase2() {
    fase=2;vasosRecogidos=0;copasRecogidas=0;
    cubatas.slice().forEach(eliminarBebida);
    proximaAparicion=tiempoJuego+0.8;
    avisoFaseHasta=tiempoJuego+3.5;
    avisoFase.textContent='¡RONDA 2! Ahora recoge vasos y copas';
    avisoFase.style.display='block';
    for(var i=0;i<11;i++) aparecerBebida();
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

    var min = Math.floor(Math.max(0, tiempoRestante) / 60);
    var seg = Math.floor(Math.max(0, tiempoRestante) % 60);

    var t = min + ':' + (seg < 10 ? '0' : '') + seg;

    var color = hielo < 30 ? '#ff6a77' : '#65e0ff';

    hud.innerHTML =
        '<span>RONDA ' + fase + '/2</span>' +
        (fase === 1 ? '<span>🥤 ' + vasosRecogidos + '/15</span>' :
        '<span>🥤 ' + vasosRecogidos + ' + 🍸 ' + copasRecogidas +
        ' = ' + (vasosRecogidos + copasRecogidas) + '/30</span>') +
        '<span>⏱ ' + t + '</span>' +
        '<span>🧊</span>' +
        '<div class="bar">' +
        '<div class="fill" style="width:' + hielo +
        '%;background:' + color + '"></div>' +
        '</div>';
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
    tiempoRestante = duracion;
    vasosRecogidos = 0;
    copasRecogidas = 0;
    fase = 1;
    tiempoJuego = 0;
    reiniciarClientesMixamo();
    proximaAparicion = 2.2;
    avisoFaseHasta = 0;
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

function terminarJuego(victoria) {
    if (estado !== 'jugando') return;

    estado = victoria ? 'victoria' : 'derrota';

    document.getElementById('lastice-titulo').textContent =
        victoria ? '¡VICTORIA! 🥤' : 'FIN DE LA PARTIDA 🧊';

    document.getElementById('lastice-detalle').textContent =
        victoria ?
        'Has completado las dos rondas antes de derretirte. ¡Misión cumplida!' :
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

        zonasTermicas.forEach(function(z, i) {
            z.x = z.baseX + z.ax * Math.sin(tMov * z.rapidez + i);
            z.z = z.baseZ + z.az * Math.sin(tMov * z.rapidez + i);

            z.grupo.position.set(z.x, 0, z.z);
        });


        var dx = 0;
        var dz = 0;

        if (modoCamara === 0) {

            // MODO TRON: conducción.
            // A y D giran, W y S avanzan o retroceden.

            var giro =
                (teclas['a'] || teclas['arrowleft'] ? 1 : 0) -
                (teclas['d'] || teclas['arrowright'] ? 1 : 0);

            personaje.rotation.y += giro * velocidadGiro * delta;

            var avance =
                (teclas['w'] || teclas['arrowup'] ? 1 : 0) -
                (teclas['s'] || teclas['arrowdown'] ? 1 : 0);

            dx = Math.sin(personaje.rotation.y) * avance;
            dz = Math.cos(personaje.rotation.y) * avance;

        } else {

            // CÁMARAS NORMAL Y PANORÁMICA:
            // Movimiento en los ejes del escenario.

            dx =
                (teclas['d'] || teclas['arrowright'] ? 1 : 0) -
                (teclas['a'] || teclas['arrowleft'] ? 1 : 0);

            dz =
                (teclas['s'] || teclas['arrowdown'] ? 1 : 0) -
                (teclas['w'] || teclas['arrowup'] ? 1 : 0);
        }

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

            // En modo TRON la orientación la controlan A y D.
            if (modoCamara !== 0) {
                personaje.rotation.y = Math.atan2(dx, dz);
            }

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
            zona === 'fria' ? 7 :
            zona === 'caliente' ? -2.5 : -0.65
        ) * delta;

        hielo = THREE.MathUtils.clamp(hielo, 0, 100);
        tiempoRestante = Math.max(0, tiempoRestante - delta);

        var escala = 0.25 + 0.75 * hielo / 100;
        materialHielo.opacity = 0.35 + 0.49 * hielo / 100;
        personaje.scale.set(escala, escala, escala);

        actualizarBebidas(delta);
        cubatas.slice().forEach(function(c) {
            var distancia = Math.hypot(personaje.position.x-c.x, personaje.position.z-c.z);
            if(distancia<1.3 && Math.abs(personaje.position.y-c.altura)<0.8) {
                if(c.tipo==='copa') copasRecogidas++;
                else vasosRecogidos++;
                hielo=Math.min(100,hielo+(c.tipo==='copa'?8:5));
                eliminarBebida(c);
            }
        });

        if(avisoFase && tiempoJuego>=avisoFaseHasta) avisoFase.style.display='none';
        if(hielo<=0 || tiempoRestante<=0) terminarJuego(false);
        else if(fase===1 && vasosRecogidos>=15) iniciarFase2();
        else if(fase===2 && vasosRecogidos+copasRecogidas>=objetivoFase2) terminarJuego(true);
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

    zonasTermicas.forEach(function(z, i) {
        z.aro.scale.setScalar(
            1 + 0.02 * Math.sin(t * 2 + i)
        );
    });

    actualizarClientesMixamo(delta);
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
        // Cámara trasera inicial. Ángulo negativo = giro a la derecha en pantalla.
        var angulo = personaje.rotation.y;
        posicionObjetivoCamara.set(
            personaje.position.x - Math.sin(angulo) * 8,
            personaje.position.y + 4.5,
            personaje.position.z - Math.cos(angulo) * 8
        );
        miradaObjetivoCamara.copy(personaje.position);
        miradaObjetivoCamara.y += 1;
    } else if (modoCamara === 1) {
        posicionObjetivoCamara.copy(personaje.position)
            .add(new THREE.Vector3(0, 10, 14));
        miradaObjetivoCamara.copy(personaje.position);
        miradaObjetivoCamara.y += 0.7;
    } else {
        posicionObjetivoCamara.set(0, 90, 48);
        miradaObjetivoCamara.set(0, 0, 0);
    }

    if (!camaraIniciada) {
        camera.position.copy(posicionObjetivoCamara);
        miradaActualCamara.copy(miradaObjetivoCamara);

        velocidadCamara.set(0, 0, 0);
        velocidadMiradaCamara.set(0, 0, 0);

        camaraIniciada = true;
    } else {
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
    modoCamara = (modoCamara + 1) % 3;
    cameraControls.enabled = false;
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
                LA ÚLTIMA RONDA
            </h2>

            <p style="line-height: 1.7;">
                Eres un cubito de hielo en una discoteca.
                Supera dos rondas recogiendo vasos y copas antes de derretirte.
                ¡Evita las zonas calientes y busca refrigeración!
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
                <b>R</b> — Reiniciar
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


// ===== CLIENTES MIXAMO (FBX, Three.js r140) =====
// Copia los FBX originales en models/mixamo/ conservando sus nombres.
// Requiere fflate.min.js y FBXLoader.js r140 cargados antes de este archivo.
// Si faltan archivos, el juego sigue funcionando sin ese personaje.

function prepararClientesMixamo() {
    if (typeof THREE.FBXLoader !== 'function') {
        console.warn('Falta FBXLoader.js. No se cargarán los clientes Mixamo.');
        return;
    }
    cargadorFBX = new THREE.FBXLoader();
    var base = 'models/mixamo/';
    var archivosAnimacion = [
        'Gangnam Style.fbx', 'Hip Hop Dancing.fbx',
        'Silly Dancing.fbx', 'Arms Hip Hop Dance.fbx',
        'Booty Hip Hop Dance.fbx', 'Walking.fbx'
    ];
    // Cargar modelos y animaciones en paralelo, sin bloquear la aparición de personajes.
    crearClientesMixamo();
    archivosAnimacion.forEach(function(nombre) {
        cargadorFBX.load(base + encodeURIComponent(nombre), function(fbx) {
            if (fbx.animations && fbx.animations.length) {
                animacionesMixamo[nombre] = fbx.animations[0];
                clientesAnimados.forEach(function(c) {
                    if (c.animNombre === nombre) activarAnimacionCliente(c);
                });
            }
        }, undefined, function(err) {
            console.warn('No se pudo cargar animación Mixamo:', base + nombre, err);
        });
    });
}

function crearClientesMixamo() {
    var base = 'models/mixamo/';
    // Cada modelo se carga una sola vez; los bailarines permanecen en la pista.
    // Los caminantes siguen rutas cerradas por pasillos libres del mobiliario.
    // Solo 5 FBX únicos (no cargar dos veces los modelos de 28-57 MB).
    // Tres bailan en pista; dos recorren los pasillos de bar y pub.
    var configuraciones = [
        {archivo:'Remy.fbx', anim:'Gangnam Style.fbx', x:-13,z:-5,altura:2.8},
        {archivo:'Ch02_nonPBR.fbx', anim:'Hip Hop Dancing.fbx', x:2,z:2,altura:2.8},
        {archivo:'Ch22_nonPBR.fbx', anim:'Silly Dancing.fbx', x:15,z:-5,altura:2.8},
        {archivo:'Ch26_nonPBR.fbx', anim:'Walking.fbx', x:-27,z:-23,altura:2.8,
            ruta:[[-27,-23],[-27,-19],[27,-19],[27,-23]]},
        {archivo:'Ch42_nonPBR.fbx', anim:'Walking.fbx', x:-31,z:22,altura:2.8,
            ruta:[[-31,22],[31,22],[31,24],[-31,24]]}
    ];
    configuraciones.forEach(function(conf) {
        cargadorFBX.load(base + encodeURIComponent(conf.archivo), function(modelo) {
            var bounds = new THREE.Box3().setFromObject(modelo);
            var tam = bounds.getSize(new THREE.Vector3());
            if (tam.y <= 0) return;
            modelo.scale.multiplyScalar(conf.altura / tam.y);
            modelo.updateMatrixWorld(true);
            bounds.setFromObject(modelo);
            var centro = bounds.getCenter(new THREE.Vector3());
            modelo.position.set(-centro.x, -bounds.min.y, -centro.z);
            var contenedor = new THREE.Group();
            contenedor.position.set(conf.x, 0, conf.z);
            contenedor.add(modelo);
            modelo.traverse(function(n) {
                if (n.isMesh) { n.castShadow = false; n.receiveShadow = false; n.frustumCulled = false; }
            });
            scene.add(contenedor);
            var mixer = new THREE.AnimationMixer(modelo);
            var cliente = {
                modelo:contenedor, mixer:mixer, ruta:conf.ruta || null,
                tramo:1, velocidad:2.3, inicio:[conf.x,conf.z],
                animNombre:conf.anim, animacionActivada:false
            };
            clientesAnimados.push(cliente);
            activarAnimacionCliente(cliente);
            console.info('Personaje Mixamo cargado:', conf.archivo);

        }, undefined, function(err) {
            console.warn('No se pudo cargar personaje Mixamo:', conf.archivo, err);
        });
    });
}

function activarAnimacionCliente(cliente) {
    if (cliente.animacionActivada) return;
    var clip = animacionesMixamo[cliente.animNombre];
    if (!clip) return;
    var clipCopia = clip.clone();
    clipCopia.tracks = clipCopia.tracks.filter(function(track) {
        return !/Hips\.position$|mixamorigHips\.position$/.test(track.name);
    });
    var accion = cliente.mixer.clipAction(clipCopia);
    accion.setLoop(THREE.LoopRepeat, Infinity);
    accion.play();
    cliente.animacionActivada = true;
}

function actualizarClientesMixamo(delta) {
    if (!partidaIniciada || estado !== 'jugando') return;
    clientesAnimados.forEach(function(c) {
        c.mixer.update(delta);
        if (!c.ruta) return;
        var destino = c.ruta[c.tramo];
        var dx = destino[0] - c.modelo.position.x;
        var dz = destino[1] - c.modelo.position.z;
        var distancia = Math.hypot(dx,dz);
        if (distancia < 0.35) {
            c.tramo = (c.tramo + 1) % c.ruta.length;
            return;
        }
        var paso = Math.min(c.velocidad * delta, distancia);
        c.modelo.position.x += dx / distancia * paso;
        c.modelo.position.z += dz / distancia * paso;
        // Mixamo mira normalmente hacia +Z, ajustar si un modelo camina de espaldas.
        c.modelo.rotation.y = Math.atan2(dx, dz);
    });
}

function reiniciarClientesMixamo() {
    clientesAnimados.forEach(function(c) {
        c.modelo.position.x = c.inicio[0];
        c.modelo.position.z = c.inicio[1];
        c.tramo = 1;
        c.mixer.setTime(0);
    });
}


// /* LAST ICE - Supervivencia 
//    Controles: WASD/flechas mover, ESPACIO saltar, C camara, R reiniciar. */

// var pantallaInicio;
// var partidaIniciada = false;

// var renderer, scene, camera, cameraControls, personaje;
// var brazoIzquierdo, brazoDerecho, piernaIzquierda, piernaDerecha, cuerpoHielo;
// var teclas = {}, grupoObstaculos = new THREE.Group(), objetosSuelo = [];
// var raycasterSuelo = new THREE.Raycaster(), clock = new THREE.Clock();
// var velocidad = 11, gravedad = -18, impulsoSalto = 8;
// var velocidadGiro = 2.5;
// var velocidadVertical = 0, enSuelo = true, tiempoAnimacion = 0;
// var mitadAnchura = 0.46, mitadProfundidad = 0.46, alturaPersonaje = 1.3;
// var anchoMundo = 110, fondoMundo = 85;
// var modoCamara = 0; // 0 normal, 1 TRON, 2 panorámica
// var camaraIniciada = false;
// var posicionObjetivoCamara = new THREE.Vector3(), miradaObjetivoCamara = new THREE.Vector3();
// var miradaActualCamara = new THREE.Vector3(), velocidadCamara = new THREE.Vector3();
// var velocidadMiradaCamara = new THREE.Vector3(), aceleracionCamara = new THREE.Vector3();
// var rigidezCamara = 35, amortiguacionCamara = 12;
// var cubatas = [], zonasTermicas = [], lucesAnimadas = [];
// var vasosRecogidos = 0, objetivoVasos = 5, hielo = 100, duracion = 240, tiempoRestante = duracion;
// var estado = 'jugando', hud, mensajeFinal, indicadorZona;
// var materialHielo;
// var obstaculosMoviles = [];

// var tiempoUltimoGolpe = -100;
// var penalizacionGolpe = 12;

// init();
// loadScene();
// crearInterfaz();
// reiniciarJuego();
// crearPantallaInicio();
// render();

// function init() {
//     renderer = new THREE.WebGLRenderer({ antialias: true });
//     renderer.setSize(window.innerWidth, window.innerHeight);
//     renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
//     renderer.shadowMap.enabled = true;
//     renderer.shadowMap.type = THREE.PCFSoftShadowMap;
//     renderer.outputEncoding = THREE.sRGBEncoding;

//     document.getElementById('container').appendChild(renderer.domElement);

//     scene = new THREE.Scene();
//     scene.background = new THREE.Color(0x100d21);
//     scene.fog = new THREE.Fog(0x100d21, 75, 220);

//     camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 300);
//     camera.position.set(0, 8, 12);

//     cameraControls = new THREE.OrbitControls(camera, renderer.domElement);
//     cameraControls.enabled = false;
//     cameraControls.enableKeys = false;
//     cameraControls.enableDamping = true;
//     cameraControls.minDistance = 3;
//     cameraControls.maxDistance = 110;
//     cameraControls.maxPolarAngle = Math.PI / 2.05;

//     window.addEventListener('resize', updateAspectRatio);

//     window.addEventListener('keydown', function(event) {
//         var k = event.key.toLowerCase();
//         if (!partidaIniciada) return;

//         if (event.code === 'Space' || event.key.indexOf('Arrow') === 0) {
//             event.preventDefault();
//         }

//         if (k === 'c' && !event.repeat) cambiarCamara();
//         if (k === 'r' && !event.repeat) reiniciarJuego();

//         if (event.code === 'Space' && !event.repeat && estado === 'jugando' && enSuelo) {
//             velocidadVertical = impulsoSalto;
//             enSuelo = false;
//         }

//         teclas[k] = true;
//     });

//     window.addEventListener('keyup', function(event) {
//         teclas[event.key.toLowerCase()] = false;
//     });

//     window.addEventListener('blur', function() {
//         teclas = {};
//     });
// }

// function material(color, extra) {
//     return new THREE.MeshStandardMaterial(
//         Object.assign({ color: color, roughness: 0.55 }, extra || {})
//     );
// }

// function caja(x, y, z, ancho, alto, fondo, mat, grupo) {
//     var m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), mat);
//     m.position.set(x, y, z);
//     m.castShadow = true;
//     m.receiveShadow = true;
//     (grupo || scene).add(m);
//     return m;
// }

// function obstaculo(x, z, ancho, alto, fondo, color, plataforma) {
//     var m = caja(
//         x, alto / 2, z, ancho, alto, fondo,
//         material(color), grupoObstaculos
//     );

//     // Todos los obstáculos sólidos tienen superficie superior.
//     objetosSuelo.push(m);
//     // IMPORTANTE: devolver el objeto 3D creado.
//     return m
// }



// function loadScene() {

//     scene.add(grupoObstaculos);

//     scene.background = new THREE.Color(0x090b1c);
//     scene.fog = new THREE.Fog(0x090b1c, 110, 310);

//     // ILUMINACIÓN GENERAL
//     scene.add(
//         new THREE.HemisphereLight(0x9bc8ff, 0x302040, 1.6)
//     );

//     var luzPrincipal = new THREE.DirectionalLight(0xffffff, 0.8);
//     luzPrincipal.position.set(-30, 60, 20);
//     scene.add(luzPrincipal);

//     // MATERIALES
//     var negro = material(0x151525, { roughness: 0.65 });
//     var violeta = material(0x35214f, { roughness: 0.5 });
//     var azul = material(0x164d75, { metalness: 0.35 });
//     var rosa = material(0xa43b78, { metalness: 0.3 });
//     var gris = material(0x35394a);
//     var blanco = material(0xc4eaff);

//     var neonAzul = new THREE.MeshBasicMaterial({
//         color: 0x35cfff
//     });

//     var neonRosa = new THREE.MeshBasicMaterial({
//         color: 0xff3eac
//     });

//     var neonVioleta = new THREE.MeshBasicMaterial({
//         color: 0x976aff
//     });

//     // FUNCIÓN PARA AÑADIR LUCES
//     function ponerLuz(x, y, z, color, intensidad, alcance) {
//         var luz = new THREE.PointLight(
//             color, intensidad, alcance, 2
//         );

//         luz.position.set(x, y, z);
//         scene.add(luz);

//         lucesAnimadas.push({
//             luz: luz,
//             fase: lucesAnimadas.length * 0.7
//         });
//     }

//     // FUNCIÓN PARA CREAR UN CARTEL CON TEXTO
//     function cartel(texto, x, y, z, ancho, color) {
//         var canvas = document.createElement('canvas');
//         canvas.width = 512;
//         canvas.height = 128;

//         var ctx = canvas.getContext('2d');
//         ctx.clearRect(0, 0, 512, 128);

//         ctx.fillStyle = color;
//         ctx.font = 'bold 58px Arial';
//         ctx.textAlign = 'center';
//         ctx.textBaseline = 'middle';
//         ctx.fillText(texto, 256, 64);

//         var textura = new THREE.CanvasTexture(canvas);

//         var plano = new THREE.Mesh(
//             new THREE.PlaneGeometry(ancho, ancho / 4),
//             new THREE.MeshBasicMaterial({
//                 map: textura,
//                 transparent: true,
//                 side: THREE.DoubleSide,
//                 depthWrite: false
//             })
//         );

//         plano.position.set(x, y, z);
//         scene.add(plano);

//         return plano;
//     }

//     // ============================================
//     // SUELO Y PERÍMETRO
//     // ============================================

//     var suelo = caja(
//         0, -0.5, 0,
//         anchoMundo, 1, fondoMundo,
//         material(0x171629, {
//             roughness: 0.55,
//             metalness: 0.15
//         })
//     );

//     objetosSuelo.push(suelo);

//     // Líneas discretas en el suelo
//     var matCuadricula = new THREE.MeshBasicMaterial({
//         color: 0x292d4e
//     });

//     for (var x = -90; x <= 90; x += 10) {
//         caja(x, 0.012, 0, 0.035, 0.02, 140, matCuadricula);
//     }

//     for (var z = -70; z <= 70; z += 10) {
//         caja(0, 0.013, z, 180, 0.02, 0.035, matCuadricula);
//     }

//     // Límites transparentes, sin líneas decorativas
//     var matPared = material(0x202442, {
//         transparent: true,
//         opacity: 0.055,
//         depthWrite: false,
//         side: THREE.DoubleSide
//     });

//     caja(0, 12, -70.2, 180, 24, 0.3, matPared);
//     caja(0, 12, 70.2, 180, 24, 0.3, matPared);
//     caja(-90.2, 12, 0, 0.3, 24, 140, matPared);
//     caja(90.2, 12, 0, 0.3, 24, 140, matPared);

//     // No creamos techo: así no tapa las cámaras.

//     // ============================================
//     // ZONA 1: BARRA PRINCIPAL
//     // ============================================

//     // Tarima que identifica la zona de barra
//     caja(-58, 0.025, -43, 54, 0.05, 42,
//          material(0x1a3044));

//     // Mostrador largo
//     obstaculo(-58, -35, 37, 2.2, 3.2, 0x325a78, false);

//     // Superficie del mostrador
//     caja(-58, 2.23, -35, 37.5, 0.16, 3.5, blanco);

//     // Luz decorativa frontal
//     caja(-58, 1.1, -33.35, 36, 0.12, 0.08, neonAzul);

//     // Estanterías detrás de la barra
//     for (var nivel = 0; nivel < 3; nivel++) {
//         caja(
//             -58, 2.5 + nivel * 2,
//             -58, 36, 0.3, 2.4, gris
//         );

//         caja(
//             -58, 2.3 + nivel * 2,
//             -56.7, 36, 0.09, 0.09, neonVioleta
//         );
//     }

//     // Botellas sobre las estanterías
//     var coloresBotellas = [
//         0x44e5ff, 0xff5baf, 0xffca55, 0x72ffbd
//     ];

//     for (var b = 0; b < 32; b++) {
//         var bx = -74 + (b % 16) * 2.1;
//         var by = 2.9 + Math.floor(b / 16) * 2;

//         var botella = new THREE.Mesh(
//             new THREE.CylinderGeometry(0.3, 0.38, 1.1, 10),
//             material(coloresBotellas[b % 4], {
//                 transparent: true,
//                 opacity: 0.85
//             })
//         );

//         botella.position.set(bx, by, -58);
//         scene.add(botella);

//         caja(
//             bx, by + 0.68, -58,
//             0.25, 0.25, 0.25, blanco
//         );
//     }

//     // Taburetes delante del mostrador
//     for (var t = 0; t < 7; t++) {
//         var tx = -74 + t * 5;

//         caja(tx, 0.8, -29, 0.25, 1.6, 0.25, gris);
//         caja(tx, 1.65, -29, 2.1, 0.25, 2.1, rosa);
//     }

//     // Máquina de hielo
//     obstaculo(-78, -55, 5, 3.2, 5, 0x68b5d5, false);
//     caja(-78, 3.3, -55, 5.2, 0.2, 5.2, blanco);
//     caja(-78, 2.2, -52.42, 3.2, 0.2, 0.08, neonAzul);

//     // Cartel sobre la barra
//     cartel('LAST ICE BAR', -58, 8, -61, 29, '#69eaff');

//     ponerLuz(-58, 8, -42, 0x22bbff, 2.8, 40);
//     ponerLuz(-78, 5, -55, 0x44ddff, 2.2, 18);

//     // ============================================
//     // ZONA 2: PISTA DE BAILE
//     // ============================================

//     var baldosas = [
//         0x203d68, 0x512b72, 0x632d58,
//         0x20565e, 0x363477
//     ];

//     for (var i = 0; i < 12; i++) {
//         for (var j = 0; j < 11; j++) {
//             var px = -32 + i * 5;
//             var pz = -24 + j * 5;

//             caja(
//                 px, 0.04, pz,
//                 4.7, 0.07, 4.7,
//                 material(baldosas[(i + j) % baldosas.length], {
//                     emissive: baldosas[(i + j) % baldosas.length],
//                     emissiveIntensity: 0.3
//                 })
//             );
//         }
//     }

//     // Cuatro columnas luminosas
//     [
//         [-37, -29],
//         [28, -29],
//         [-37, 31],
//         [28, 31]
//     ].forEach(function(p, i) {
//         obstaculo(p[0], p[1], 2.3, 9, 2.3, 0x34344f, false);

//         caja(
//             p[0], 4.5, p[1] + 1.2,
//             0.22, 8.5, 0.12,
//             i % 2 === 0 ? neonAzul : neonRosa
//         );
//     });

//     // Luces suspendidas sobre la pista
//     for (var f = 0; f < 8; f++) {
//         var fx = -27 + (f % 4) * 16;
//         var fz = -15 + Math.floor(f / 4) * 29;

//         caja(
//             fx, 13, fz,
//             2, 0.5, 2,
//             f % 2 === 0 ? neonRosa : neonAzul
//         );

//         ponerLuz(
//             fx, 11.5, fz,
//             f % 2 === 0 ? 0xff44aa : 0x44aaff,
//             2.1, 23
//         );
//     }

//     // ============================================
//     // ZONA 3: CABINA DEL DJ
//     // ============================================

//     caja(62, 0.18, -30, 38, 0.36, 26, violeta);

//     obstaculo(62, -32, 23, 3, 4, 0x343047, false);

//     caja(62, 3.1, -32, 23, 0.2, 4.3, negro);

//     // Platos de mezcla
//     for (var d = 0; d < 2; d++) {
//         var plato = new THREE.Mesh(
//             new THREE.CylinderGeometry(1.7, 1.7, 0.12, 32),
//             negro
//         );

//         plato.position.set(56 + d * 12, 3.25, -32);
//         scene.add(plato);

//         var aro = new THREE.Mesh(
//             new THREE.TorusGeometry(1.4, 0.09, 8, 40),
//             neonRosa
//         );

//         aro.rotation.x = Math.PI / 2;
//         aro.position.set(56 + d * 12, 3.34, -32);
//         scene.add(aro);
//     }

//     // Altavoces grandes
//     function altavoz(x, z) {
//         obstaculo(x, z, 4, 8, 3, 0x191a28, false);

//         for (var a = 0; a < 2; a++) {
//             var cono = new THREE.Mesh(
//                 new THREE.CylinderGeometry(1.1, 1.1, 0.15, 28),
//                 neonVioleta
//             );

//             cono.rotation.x = Math.PI / 2;
//             cono.position.set(x, 2.5 + a * 3, z + 1.55);
//             scene.add(cono);
//         }
//     }

//     altavoz(43, -40);
//     altavoz(81, -40);

//     cartel('DJ STATION', 62, 10, -44, 23, '#ff63c4');

//     ponerLuz(62, 10, -30, 0xff44aa, 3, 35);

//     // ============================================
//     // ZONA 4: VIP
//     // ============================================

//     caja(-55, 0.025, 46, 60, 0.05, 38,
//          material(0x352447));

//     cartel('VIP LOUNGE', -55, 8, 64, 28, '#e69bff');

//     // Sofás y mesas VIP
//     function sofa(x, z, color) {
//         obstaculo(x, z, 9, 1.3, 3, color, false);
//         obstaculo(x, z + 1.8, 9, 2.7, 0.8, color, false);

//         // Reposabrazos
//         obstaculo(x - 4.3, z, 0.7, 2, 3, color, false);
//         obstaculo(x + 4.3, z, 0.7, 2, 3, color, false);
//     }

//     sofa(-72, 41, 0x724e92);
//     sofa(-51, 41, 0x724e92);
//     sofa(-30, 41, 0x724e92);

//     for (var v = 0; v < 3; v++) {
//         var vx = -72 + v * 21;

//         obstaculo(vx, 49, 4, 1.1, 4, 0x4d638b, false);
//         caja(vx, 1.13, 49, 4.3, 0.12, 4.3, blanco);
//     }

//     ponerLuz(-55, 8, 47, 0xbb55ff, 3, 38);

//     // ============================================
//     // ZONA 5: LOUNGE Y DESCANSO
//     // ============================================

//     caja(58, 0.025, 47, 55, 0.05, 38,
//          material(0x173e43));

//     cartel('CHILL ZONE', 58, 8, 64, 25, '#71ffe5');

//     // Mesas redondas
//     function mesaRedonda(x, z) {
//         var pie = new THREE.Mesh(
//             new THREE.CylinderGeometry(0.22, 0.35, 1.4, 16),
//             gris
//         );

//         pie.position.set(x, 0.7, z);
//         scene.add(pie);

//         var tablero = new THREE.Mesh(
//             new THREE.CylinderGeometry(2.1, 2.1, 0.2, 32),
//             azul
//         );

//         tablero.position.set(x, 1.5, z);
//         scene.add(tablero);
//     }

//     [
//         [44, 38],
//         [68, 38],
//         [44, 56],
//         [68, 56]
//     ].forEach(function(p) {
//         mesaRedonda(p[0], p[1]);
//     });

//     // Máquina refrigeradora del lounge
//     obstaculo(80, 58, 5, 4, 5, 0x448ba5, false);
//     caja(80, 2.4, 60.55, 3.4, 1.8, 0.1, neonAzul);

//     ponerLuz(58, 8, 48, 0x44ffcc, 2.5, 36);

//     // ============================================
//     // BEBIDAS Y ZONAS TÉRMICAS
//     // ============================================

//     // Cinco bebidas distribuidas por el escenario
//     crearCubata(-48, -23, 0); // Barra
//     crearCubata(16, -4, 0);   // Pista de baile
//     crearCubata(76, -20, 0);  // DJ
//     crearCubata(-52, 55, 0);  // VIP
//     crearCubata(58, 47, 0);   // Lounge

//     // Zonas frías
//     crearZona(-78, -48, 5, 'fria');
//     crearZona(79, 49, 5, 'fria');
//     crearZona(-17, 52, 4, 'fria');

//     // Zonas calientes
//     crearZona(0, 0, 6, 'caliente');
//     crearZona(23, 16, 5, 'caliente', 4, 0, 0.5);
//     crearZona(60, -20, 4, 'caliente');

//     // ============================================
//     // OBSTÁCULOS MÓVILES
//     // ============================================

//     // Algunos obstáculos en la pista de baile.
//     // No llenamos toda la discoteca de cubos.
//     crearObstaculoMovil(-15, 12, 5, 0, 0.8);
//     crearObstaculoMovil(9, -15, 0, 5, 0.7);
//     crearObstaculoMovil(30, 6, 0, 4, 0.9);

//     // ============================================
//     // PERSONAJE
//     // ============================================

//     crearPersonaje();


//     // ============================================
//     // MODELOS GLTF
//     // ============================================

//     // Clientes junto a la barra
//     cargarModelo(
//         'models/boy/scene.gltf',
//         -48, -25, 2.4, 1, Math.PI
//     );

//     cargarModelo(
//         'models/boy/scene.gltf',
//         -61, -25, 2.4, 1, Math.PI
//     );

//     cargarModelo(
//         'models/boy/scene.gltf',
//         -35, -25, 2.4, 1, Math.PI
//     );

//     // Clientes en la zona VIP
//     cargarModelo(
//         'models/boy/scene.gltf',
//         -65, 35, 2.4, 1, 0
//     );

//     cargarModelo(
//         'models/boy/scene.gltf',
//         -42, 35, 2.4, 1, 0
//     );

//     // Mesas altas con sillas en zonas abiertas
//     [
//         [-77, -12],
//         [-57, -12],
//         [-37, -12],
//         [40, 42],
//         [66, 42],
//         [55, 60]
//     ].forEach(function(p) {
//         cargarModelo(
//             'models/mesa/scene.gltf',
//             p[0], p[1], 2.5, 1, 0
//         );
//     });

//     // Latas decorativas en la barra
//     cargarModelo(
//         'models/latas/scene.gltf',
//         -68, -35, 0.7, 1, 0
//     );

// }



// function crearZona(x, z, radio, tipo, ax, az, rapidez) {
//     var color = tipo === 'fria' ? 0x40baff : 0xff713e;

//     var grupo = new THREE.Group();
//     grupo.position.set(x, 0, z);
//     scene.add(grupo);

//     var disco = new THREE.Mesh(
//         new THREE.CylinderGeometry(radio, radio, 0.035, 48),
//         new THREE.MeshBasicMaterial({
//             color: color,
//             transparent: true,
//             opacity: 0.34,
//             depthWrite: false
//         })
//     );

//     disco.position.y = 0.035;
//     grupo.add(disco);

//     var aro = new THREE.Mesh(
//         new THREE.TorusGeometry(radio, 0.07, 8, 60),
//         new THREE.MeshBasicMaterial({ color: color })
//     );

//     aro.rotation.x = Math.PI / 2;
//     aro.position.y = 0.07;
//     grupo.add(aro);

//     var luz = new THREE.PointLight(color, 0.8, radio * 3);
//     luz.position.y = 1.3;
//     grupo.add(luz);

//     zonasTermicas.push({
//         x: x,
//         z: z,
//         baseX: x,
//         baseZ: z,
//         radio: radio,
//         tipo: tipo,
//         aro: aro,
//         grupo: grupo,
//         luz: luz,
//         ax: ax || 0,
//         az: az || 0,
//         rapidez: rapidez || 0
//     });
// }    

// function crearPersonaje() {
//     personaje = new THREE.Group();

//     materialHielo = material(0x83e6ff, {
//         transparent: true,
//         opacity: 0.84,
//         roughness: 0.16,
//         metalness: 0.08
//     });

//     var matExtremidades = material(0x43a9d2);
//     var matOjos = new THREE.MeshBasicMaterial({ color: 0x10152c });

//     cuerpoHielo = caja(
//         0, 0.8, 0, 1, 1, 1,
//         materialHielo, personaje
//     );

//     function extremidad(x, y, w, h) {
//         var g = new THREE.Group();
//         g.position.set(x, y, 0);

//         caja(0, -h / 2, 0, w, h, w, matExtremidades, g);
//         personaje.add(g);

//         return g;
//     }

//     brazoIzquierdo = extremidad(-0.58, 0.95, 0.2, 0.6);
//     brazoDerecho = extremidad(0.58, 0.95, 0.2, 0.6);
//     piernaIzquierda = extremidad(-0.25, 0.35, 0.2, 0.35);
//     piernaDerecha = extremidad(0.25, 0.35, 0.2, 0.35);

//     // Ojos
//     [-0.2, 0.2].forEach(function(px) {
//         var ojo = new THREE.Mesh(
//             new THREE.SphereGeometry(0.09, 16, 12),
//             matOjos
//         );

//         ojo.position.set(px, 0.95, 0.51);
//         personaje.add(ojo);
//     });

//     // Sonrisa
//     var sonrisa = new THREE.Mesh(
//         new THREE.TorusGeometry(0.12, 0.017, 6, 18, Math.PI),
//         matOjos
//     );

//     sonrisa.rotation.z = Math.PI;
//     sonrisa.position.set(0, 0.68, 0.515);
//     personaje.add(sonrisa);

//     scene.add(personaje);
// }

// function crearCubata(x, z, altura) {
//     var g = new THREE.Group();

//     var vidrio = material(0xb7edff, {
//         transparent: true,
//         opacity: 0.4,
//         roughness: 0.1,
//         metalness: 0.1,
//         side: THREE.DoubleSide,
//         depthWrite: false
//     });

//     var vaso = new THREE.Mesh(
//         new THREE.CylinderGeometry(0.44, 0.34, 0.95, 24, 1, true),
//         vidrio
//     );
//     vaso.position.y = 0.52;
//     g.add(vaso);

//     var liquido = new THREE.Mesh(
//         new THREE.CylinderGeometry(0.385, 0.335, 0.58, 24),
//         material(0xffad4b, { transparent: true, opacity: 0.75 })
//     );
//     liquido.position.y = 0.35;
//     g.add(liquido);

//     var borde = new THREE.Mesh(
//         new THREE.TorusGeometry(0.44, 0.035, 8, 24),
//         material(0xe7ffff, {
//             emissive: 0x44bbee,
//             emissiveIntensity: 0.5
//         })
//     );
//     borde.rotation.x = Math.PI / 2;
//     borde.position.y = 0.99;
//     g.add(borde);

//     var pajita = new THREE.Mesh(
//         new THREE.CylinderGeometry(0.035, 0.035, 1.25, 10),
//         material(0xff55b5)
//     );
//     pajita.position.set(0.18, 1.04, 0);
//     pajita.rotation.z = 0.22;
//     g.add(pajita);

//     var halo = new THREE.Mesh(
//         new THREE.TorusGeometry(0.78, 0.045, 8, 40),
//         new THREE.MeshBasicMaterial({ color: 0xffd978 })
//     );
//     halo.rotation.x = Math.PI / 2;
//     halo.position.y = 0.08;
//     g.add(halo);

//     g.position.set(x, altura || 0, z);
//     scene.add(g);

//     cubatas.push({
//         grupo: g,
//         x: x,
//         z: z,
//         altura: altura || 0,
//         recogido: false,
//         halo: halo
//     });
// }


// function crearInterfaz() {
//     var style = document.createElement('style');

//     style.textContent = `
//         #lastice-hud {
//             position: fixed;
//             bottom: 18px;
//             left: 50%;
//             transform: translateX(-50%);
//             z-index: 10;
//             display: flex;
//             align-items: center;
//             gap: 24px;
//             padding: 10px 20px;
//             background: rgba(13, 10, 29, 0.82);
//             border: 1px solid #6ac9f0;
//             border-radius: 30px;
//             color: white;
//             font: 600 16px Arial, sans-serif;
//             white-space: nowrap;
//             pointer-events: none;
//         }

//         #lastice-hud .bar {
//             width: 130px;
//             height: 12px;
//             background: #49314c;
//             border-radius: 10px;
//             overflow: hidden;
//         }

//         #lastice-hud .fill {
//             height: 100%;
//             background: #65e0ff;
//         }

//         #lastice-final {
//             display: none;
//             position: fixed;
//             inset: 0;
//             z-index: 20;
//             align-items: center;
//             justify-content: center;
//             background: #070712b8;
//             color: white;
//             font-family: Arial, sans-serif;
//             text-align: center;
//         }

//         #lastice-final .panel {
//             padding: 35px 45px;
//             background: #201b36;
//             border: 2px solid #77dbff;
//             border-radius: 18px;
//         }
//     `;

//     document.head.appendChild(style);

//     hud = document.createElement('div');
//     hud.id = 'lastice-hud';
//     document.body.appendChild(hud);

//     mensajeFinal = document.createElement('div');
//     mensajeFinal.id = 'lastice-final';

//     mensajeFinal.innerHTML =
//         '<div class="panel">' +
//         '<h1 id="lastice-titulo"></h1>' +
//         '<p id="lastice-detalle"></p>' +
//         '<p>Pulsa <b>R</b> para volver a jugar</p>' +
//         '</div>';

//     document.body.appendChild(mensajeFinal);

//     actualizarHUD('');
// }

// function actualizarHUD(zona) {
//     if (!hud) return;

//     var min = Math.floor(Math.max(0, tiempoRestante) / 60);
//     var seg = Math.floor(Math.max(0, tiempoRestante) % 60);

//     var t = min + ':' + (seg < 10 ? '0' : '') + seg;

//     var color = hielo < 30 ? '#ff6a77' : '#65e0ff';

//     hud.innerHTML =
//         '<span>🥤 ' + vasosRecogidos + '/' + objetivoVasos + '</span>' +
//         '<span>⏱ ' + t + '</span>' +
//         '<span>🧊</span>' +
//         '<div class="bar">' +
//         '<div class="fill" style="width:' + hielo +
//         '%;background:' + color + '"></div>' +
//         '</div>';
// }


// function reiniciarJuego() {
//     if (!personaje) return;

//     personaje.position.set(-69, 0, -22);
//     personaje.rotation.set(0, 0, 0);
//     personaje.scale.set(1, 1, 1);

//     velocidadVertical = 0;
//     enSuelo = true;
//     tiempoUltimoGolpe = -100;

//     hielo = 100;
//     tiempoRestante = duracion;
//     vasosRecogidos = 0;
//     estado = 'jugando';
//     teclas = {};

//     cubatas.forEach(function(c) {
//         c.recogido = false;
//         c.grupo.visible = true;
//     });

//     if (mensajeFinal) {
//         mensajeFinal.style.display = 'none';
//     }

//     modoCamara = 0;
//     camaraIniciada = false;
//     cameraControls.enabled = false;

//     actualizarHUD('');
// }

// function terminarJuego(victoria) {
//     if (estado !== 'jugando') return;

//     estado = victoria ? 'victoria' : 'derrota';

//     document.getElementById('lastice-titulo').textContent =
//         victoria ? '¡VICTORIA! 🥤' : 'FIN DE LA PARTIDA 🧊';

//     document.getElementById('lastice-detalle').textContent =
//         victoria ?
//         'Has enfriado los cinco cubatas. ¡Misión cumplida!' :
//         (hielo <= 0 ?
//          'Te has derretido antes de terminar.' :
//          'Se ha agotado el tiempo.');

//     mensajeFinal.style.display = 'flex';
// }

// function cajaColision(x, z) {
//     return new THREE.Box3(
//         new THREE.Vector3(
//             x - mitadAnchura,
//             personaje.position.y + 0.06,
//             z - mitadProfundidad
//         ),
//         new THREE.Vector3(
//             x + mitadAnchura,
//             personaje.position.y + alturaPersonaje,
//             z + mitadProfundidad
//         )
//     );
// }

// function puedeMoverse(x, z) {
//     var actual = cajaColision(
//         personaje.position.x,
//         personaje.position.z
//     );

//     var siguiente = cajaColision(x, z);
//     var permitido = true;

//     grupoObstaculos.updateMatrixWorld(true);

//     grupoObstaculos.children.forEach(function(m) {
//         if (!m.isMesh) return;

//         var cajaO = new THREE.Box3().setFromObject(m);

//         if (!siguiente.intersectsBox(cajaO)) return;

//         if (!actual.intersectsBox(cajaO)) {
//             permitido = false;
//             return;
//         }

//         // Permitir salir de una superposicion existente
//         var a = actual.clone()
//             .intersect(cajaO)
//             .getSize(new THREE.Vector3());

//         var b = siguiente.clone()
//             .intersect(cajaO)
//             .getSize(new THREE.Vector3());

//         if (b.x * b.y * b.z > a.x * a.y * a.z + 0.0000001) {
//             permitido = false;
//         }
//     });

//     return permitido;
// }



// function superficiesBajoPersonaje() {
//     var resultado = [{ altura: 0 }];

//     grupoObstaculos.updateMatrixWorld(true);

//     objetosSuelo.forEach(function(m) {
//         if (m === objetosSuelo[0]) return;

//         var b = new THREE.Box3().setFromObject(m);

//         // Comprobamos el centro del personaje sobre el objeto.
//         if (
//             personaje.position.x >= b.min.x + 0.05 &&
//             personaje.position.x <= b.max.x - 0.05 &&
//             personaje.position.z >= b.min.z + 0.05 &&
//             personaje.position.z <= b.max.z - 0.05
//         ) {
//             resultado.push({ altura: b.max.y });
//         }
//     });

//     return resultado;
// }


// function actualizarSalto(delta) {
//     var pieAnterior = personaje.position.y;
//     var superficies = superficiesBajoPersonaje();
//     var apoyo = -Infinity;

//     superficies.forEach(function(s) {
//         if (s.altura <= pieAnterior + 0.025) {
//             apoyo = Math.max(apoyo, s.altura);
//         }
//     });

//     if (enSuelo && Math.abs(pieAnterior - apoyo) > 0.035) {
//         enSuelo = false;
//         velocidadVertical = 0;
//     }

//     if (enSuelo) {
//         personaje.position.y = apoyo;
//         return;
//     }

//     velocidadVertical += gravedad * delta;

//     var pieNuevo = pieAnterior + velocidadVertical * delta;

//     if (velocidadVertical <= 0) {
//         var aterrizaje = -Infinity;

//         superficies.forEach(function(s) {
//             if (
//                 pieAnterior >= s.altura - 0.025 &&
//                 pieNuevo <= s.altura
//             ) {
//                 aterrizaje = Math.max(aterrizaje, s.altura);
//             }
//         });

//         if (aterrizaje > -Infinity) {
//             personaje.position.y = aterrizaje;
//             velocidadVertical = 0;
//             enSuelo = true;
//             return;
//         }
//     }

//     personaje.position.y = pieNuevo;
// }



// function update(delta) {
//     if (partidaIniciada && estado === 'jugando') {
//         var tMov = clock.elapsedTime;
//         var anteriorX = personaje.position.x;
//         var anteriorZ = personaje.position.z;

//         obstaculosMoviles.forEach(function(o, i) {
//             o.anteriorX = o.m.position.x;
//             o.anteriorZ = o.m.position.z;
//             o.m.position.x =
//                 o.x + o.ax * Math.sin(tMov * o.rapidez + i);

//             o.m.position.z =
//                 o.z + o.az * Math.sin(tMov * o.rapidez + i);
//         });

//         zonasTermicas.forEach(function(z, i) {
//             z.x = z.baseX + z.ax * Math.sin(tMov * z.rapidez + i);
//             z.z = z.baseZ + z.az * Math.sin(tMov * z.rapidez + i);

//             z.grupo.position.set(z.x, 0, z.z);
//         });


//         var dx = 0;
//         var dz = 0;

//         if (modoCamara === 1) {

//             // MODO TRON: conducción.
//             // A y D giran, W y S avanzan o retroceden.

//             var giro =
//                 (teclas['d'] || teclas['arrowright'] ? 1 : 0) -
//                 (teclas['a'] || teclas['arrowleft'] ? 1 : 0);

//             personaje.rotation.y += giro * velocidadGiro * delta;

//             var avance =
//                 (teclas['w'] || teclas['arrowup'] ? 1 : 0) -
//                 (teclas['s'] || teclas['arrowdown'] ? 1 : 0);

//             dx = Math.sin(personaje.rotation.y) * avance;
//             dz = Math.cos(personaje.rotation.y) * avance;

//         } else {

//             // CÁMARAS NORMAL Y PANORÁMICA:
//             // Movimiento en los ejes del escenario.

//             dx =
//                 (teclas['d'] || teclas['arrowright'] ? 1 : 0) -
//                 (teclas['a'] || teclas['arrowleft'] ? 1 : 0);

//             dz =
//                 (teclas['s'] || teclas['arrowdown'] ? 1 : 0) -
//                 (teclas['w'] || teclas['arrowup'] ? 1 : 0);
//         }

//         var moviendo = dx !== 0 || dz !== 0;

//         if (moviendo) {

//             var len = Math.sqrt(dx * dx + dz * dz);
//             dx /= len;
//             dz /= len;

//             var paso = velocidad * delta;

//             var nuevoX = THREE.MathUtils.clamp(
//                 personaje.position.x + dx * paso,
//                 -88.5,
//                 88.5
//             );

//             if (puedeMoverse(nuevoX, personaje.position.z)) {
//                 personaje.position.x = nuevoX;
//             }

//             var nuevoZ = THREE.MathUtils.clamp(
//                 personaje.position.z + dz * paso,
//                 -68.5,
//                 68.5
//             );

//             if (puedeMoverse(personaje.position.x, nuevoZ)) {
//                 personaje.position.z = nuevoZ;
//             }

//             // En modo TRON la orientación la controlan A y D.
//             if (modoCamara !== 1) {
//                 personaje.rotation.y = Math.atan2(dx, dz);
//             }

//             tiempoAnimacion += delta * 11;
//         }


//         var oscilacion = moviendo ?
//             Math.sin(tiempoAnimacion) * 0.5 : 0;

//         piernaIzquierda.rotation.x = oscilacion;
//         piernaDerecha.rotation.x = -oscilacion;
//         brazoIzquierdo.rotation.x = -oscilacion;
//         brazoDerecho.rotation.x = oscilacion;

//         actualizarSalto(delta);
//         comprobarChoquesMoviles(tMov, anteriorX, anteriorZ);

//         var zona = '';

//         zonasTermicas.forEach(function(z) {
//             var d = Math.hypot(
//                 personaje.position.x - z.x,
//                 personaje.position.z - z.z
//             );

//             if (d < z.radio && personaje.position.y < 1.1) {
//                 zona = z.tipo;
//             }
//         });

//         hielo += (
//             zona === 'fria' ? 7 :
//             zona === 'caliente' ? -2.5 : -0.65
//         ) * delta;

//         hielo = THREE.MathUtils.clamp(hielo, 0, 100);
//         tiempoRestante = Math.max(0, tiempoRestante - delta);

//         var escala = 0.25 + 0.75 * hielo / 100;
//         materialHielo.opacity = 0.35 + 0.49 * hielo / 100;
//         personaje.scale.set(escala, escala, escala);

//         cubatas.forEach(function(c) {
//             var distancia = Math.hypot(
//                 personaje.position.x - c.x,
//                 personaje.position.z - c.z
//             );

//             if (
//                 !c.recogido &&
//                 distancia < 0.95 &&
//                 Math.abs(personaje.position.y - c.altura) < 0.55
//             ) {
//                 c.recogido = true;
//                 c.grupo.visible = false;
//                 vasosRecogidos++;
//                 hielo = Math.min(100, hielo + 12);
//             }
//         });

//         actualizarHUD(zona);

//         if (vasosRecogidos >= objetivoVasos) {
//             terminarJuego(true);
//         }
//         else if (hielo <= 0 || tiempoRestante <= 0) {
//             terminarJuego(false);
//         }
//     }

//     var t = clock.elapsedTime;

//     cubatas.forEach(function(c, i) {
//         if (!c.recogido) {
//             c.grupo.rotation.y =
//                 Math.sin(t * 1.4 + i) * 0.18;

//             c.halo.scale.setScalar(
//                 1 + 0.07 * Math.sin(t * 3 + i)
//             );
//         }
//     });

//     lucesAnimadas.forEach(function(l) {
//         l.luz.intensity =
//             1.35 + 0.65 * Math.sin(t * 1.9 + l.fase);
//     });

//     zonasTermicas.forEach(function(z, i) {
//         z.aro.scale.setScalar(
//             1 + 0.02 * Math.sin(t * 2 + i)
//         );
//     });

//     updateCamera(delta);
// }


// function actualizarResorte(actual, vel, objetivo, delta) {
//     aceleracionCamara.copy(objetivo)
//         .sub(actual)
//         .multiplyScalar(rigidezCamara);

//     aceleracionCamara.addScaledVector(
//         vel, -amortiguacionCamara
//     );

//     vel.addScaledVector(aceleracionCamara, delta);
//     actual.addScaledVector(vel, delta);
// }


// function updateCamera(delta) {

//     if (modoCamara === 0) {

//         // CÁMARA NORMAL: elevada y siguiendo al cubito.
//         posicionObjetivoCamara.copy(personaje.position)
//             .add(new THREE.Vector3(0, 10, 14));

//         miradaObjetivoCamara.copy(personaje.position);
//         miradaObjetivoCamara.y += 0.7;

//     } else if (modoCamara === 1) {

//         // CÁMARA TRON: detrás del cubito.
//         var angulo = personaje.rotation.y;
//         var distancia = 8;
//         var altura = 4.5;

//         posicionObjetivoCamara.set(
//             personaje.position.x - Math.sin(angulo) * distancia,
//             personaje.position.y + altura,
//             personaje.position.z - Math.cos(angulo) * distancia
//         );

//         miradaObjetivoCamara.copy(personaje.position);
//         miradaObjetivoCamara.y += 1;

//     } else {

//         // PANORÁMICA: centrada en toda la discoteca.
//         posicionObjetivoCamara.set(0, 165, 95);
//         miradaObjetivoCamara.set(0, 0, 0);
//     }

//     if (!camaraIniciada) {
//         camera.position.copy(posicionObjetivoCamara);
//         miradaActualCamara.copy(miradaObjetivoCamara);

//         velocidadCamara.set(0, 0, 0);
//         velocidadMiradaCamara.set(0, 0, 0);

//         camaraIniciada = true;
//     } else {
//         actualizarResorte(
//             camera.position,
//             velocidadCamara,
//             posicionObjetivoCamara,
//             delta
//         );

//         actualizarResorte(
//             miradaActualCamara,
//             velocidadMiradaCamara,
//             miradaObjetivoCamara,
//             delta
//         );
//     }

//     camera.lookAt(miradaActualCamara);
// }
    

// function cambiarCamara() {
//     modoCamara = (modoCamara + 1) % 3;
//     cameraControls.enabled = false;
// }

// function updateAspectRatio() {
//     renderer.setSize(window.innerWidth, window.innerHeight);
//     camera.aspect = window.innerWidth / window.innerHeight;
//     camera.updateProjectionMatrix();
// }

// function render() {
//     requestAnimationFrame(render);

//     var delta = Math.min(clock.getDelta(), 0.05);
//     update(delta);

//     renderer.render(scene, camera);
// }


// function crearObstaculoMovil(x, z, amplitudX, amplitudZ, rapidez) {
//     var m = obstaculo(x, z, 1.25, 1.05, 1.25, 0xe06c9e, false);

//     obstaculosMoviles.push({
//         m: m,
//         x: x,
//         z: z,
//         ax: amplitudX,
//         az: amplitudZ,
//         rapidez: rapidez
//     });
// }


// function comprobarChoquesMoviles(tiempoActual, anteriorX, anteriorZ) {
//     var cajaJugador = cajaColision(
//         personaje.position.x,
//         personaje.position.z
//     );

//     var choque = false;

//     obstaculosMoviles.forEach(function(o) {
//         var cajaMovil = new THREE.Box3().setFromObject(o.m);

//         if (cajaJugador.intersectsBox(cajaMovil)) {
//             choque = true;

//             // El obstáculo retrocede si alcanza al personaje.
//             if (o.anteriorX !== undefined) {
//                 o.m.position.x = o.anteriorX;
//                 o.m.position.z = o.anteriorZ;
//                 o.m.updateMatrixWorld(true);
//             }
//         }
//     });

//     if (!choque) return;

//     // Recuperamos la posición anterior del jugador.
//     personaje.position.x = anteriorX;
//     personaje.position.z = anteriorZ;

//     // Evitar que un mismo contacto quite hielo cada fotograma.
//     if (tiempoActual - tiempoUltimoGolpe > 1.2) {
//         hielo = Math.max(0, hielo - penalizacionGolpe);
//         tiempoUltimoGolpe = tiempoActual;
//     }
// }



// function crearPantallaInicio() {

//     pantallaInicio = document.createElement('div');
//     pantallaInicio.id = 'pantalla-inicio';

//     pantallaInicio.style.cssText = `
//         position: fixed;
//         inset: 0;
//         z-index: 100;
//         display: flex;
//         align-items: center;
//         justify-content: center;
//         background: rgba(6, 8, 23, 0.94);
//         color: white;
//         font-family: Arial, sans-serif;
//         text-align: center;
//     `;

//     pantallaInicio.innerHTML = `
//         <div style="
//             width: min(520px, 88vw);
//             padding: 42px 35px;
//             border: 2px solid #65e0ff;
//             border-radius: 20px;
//             background: #15162c;
//             box-shadow: 0 0 50px #225d88;
//         ">

//             <h1 style="
//                 font-size: 64px;
//                 color: #65e0ff;
//                 margin: 0;
//                 text-shadow: 0 0 20px #32aaff;
//             ">
//                 LAST ICE
//             </h1>

//             <h2 style="
//                 color: #ff78c4;
//                 font-size: 19px;
//                 margin: 12px 0 25px;
//             ">
//                 LA ÚLTIMA RONDA
//             </h2>

//             <p style="line-height: 1.7;">
//                 Eres un cubito de hielo en una discoteca.
//                 Encuentra las cinco bebidas antes de derretirte.
//                 ¡Evita las zonas calientes y busca refrigeración!
//             </p>

//             <div style="
//                 margin: 25px 0;
//                 padding: 18px;
//                 background: #20243f;
//                 border-radius: 12px;
//                 line-height: 2;
//             ">
//                 <b>WASD / Flechas</b> — Moverse<br>
//                 <b>ESPACIO</b> — Saltar<br>
//                 <b>C</b> — Cambiar cámara<br>
//                 <b>R</b> — Reiniciar
//             </div>

//             <button id="boton-jugar" style="
//                 padding: 15px 55px;
//                 background: #65e0ff;
//                 color: #101426;
//                 border: none;
//                 border-radius: 12px;
//                 font-size: 22px;
//                 font-weight: bold;
//                 cursor: pointer;
//                 box-shadow: 0 0 22px #2699d5;
//             ">
//                 ▶ JUGAR
//             </button>

//         </div>
//     `;

//     document.body.appendChild(pantallaInicio);

//     document.getElementById('boton-jugar')
//         .addEventListener('click', function() {

//             partidaIniciada = true;
//             pantallaInicio.style.display = 'none';

//             reiniciarJuego();
//             clock.getDelta();
//         });
// }



// function cargarModelo(ruta, x, z, altura, escala, rotacion) {

//     var loader = new THREE.GLTFLoader();

//     loader.load(
//         ruta,

//         function(gltf) {

//             var modelo = gltf.scene;

//             // Centramos el modelo horizontalmente.
//             modelo.updateMatrixWorld(true);

//             var cajaModelo = new THREE.Box3().setFromObject(modelo);
//             var centro = cajaModelo.getCenter(new THREE.Vector3());
//             var dimensiones = cajaModelo.getSize(new THREE.Vector3());

//             if (dimensiones.y === 0) return;

//             // Normalizamos el tamaño para que no aparezcan
//             // modelos gigantes o diminutos.
//             var factor = altura / dimensiones.y;
//             modelo.scale.multiplyScalar(factor * escala);

//             modelo.updateMatrixWorld(true);

//             cajaModelo.setFromObject(modelo);
//             centro = cajaModelo.getCenter(new THREE.Vector3());

//             modelo.position.x += x - centro.x;
//             modelo.position.z += z - centro.z;
//             modelo.position.y += -cajaModelo.min.y;

//             modelo.rotation.y += rotacion || 0;

//             modelo.traverse(function(obj) {
//                 if (obj.isMesh) {
//                     obj.castShadow = true;
//                     obj.receiveShadow = true;
//                 }
//             });

//             scene.add(modelo);
//         },

//         undefined,

//         function(error) {
//             console.error('Error cargando modelo:', ruta, error);
//         }
//     );
// }


// /* LAST ICE - Supervivencia 
//    Controles: WASD/flechas mover, ESPACIO saltar, C camara, R reiniciar. */

// var pantallaInicio;
// var partidaIniciada = false;

// var renderer, scene, camera, cameraControls, personaje;
// var brazoIzquierdo, brazoDerecho, piernaIzquierda, piernaDerecha, cuerpoHielo;
// var teclas = {}, grupoObstaculos = new THREE.Group(), objetosSuelo = [];
// var raycasterSuelo = new THREE.Raycaster(), clock = new THREE.Clock();
// var velocidad = 11, gravedad = -18, impulsoSalto = 8;
// var velocidadGiro = 2.5;
// var velocidadVertical = 0, enSuelo = true, tiempoAnimacion = 0;
// var mitadAnchura = 0.46, mitadProfundidad = 0.46, alturaPersonaje = 1.3;
// var anchoMundo = 110, fondoMundo = 85;
// var modoCamara = 0; // 0 normal, 1 TRON, 2 panorámica
// var camaraIniciada = false;
// var posicionObjetivoCamara = new THREE.Vector3(), miradaObjetivoCamara = new THREE.Vector3();
// var miradaActualCamara = new THREE.Vector3(), velocidadCamara = new THREE.Vector3();
// var velocidadMiradaCamara = new THREE.Vector3(), aceleracionCamara = new THREE.Vector3();
// var rigidezCamara = 35, amortiguacionCamara = 12;
// var cubatas = [], zonasTermicas = [], lucesAnimadas = [];
// var vasosRecogidos = 0, objetivoVasos = 5, hielo = 100, duracion = 240, tiempoRestante = duracion;
// var estado = 'jugando', hud, mensajeFinal, indicadorZona;
// var materialHielo;
// var obstaculosMoviles = [];

// var tiempoUltimoGolpe = -100;
// var penalizacionGolpe = 12;

// init();
// loadScene();
// crearInterfaz();
// reiniciarJuego();
// crearPantallaInicio();
// render();

// function init() {
//     renderer = new THREE.WebGLRenderer({ antialias: true });
//     renderer.setSize(window.innerWidth, window.innerHeight);
//     renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
//     renderer.shadowMap.enabled = true;
//     renderer.shadowMap.type = THREE.PCFSoftShadowMap;
//     renderer.outputEncoding = THREE.sRGBEncoding;

//     document.getElementById('container').appendChild(renderer.domElement);

//     scene = new THREE.Scene();
//     scene.background = new THREE.Color(0x100d21);
//     scene.fog = new THREE.Fog(0x100d21, 75, 220);

//     camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 300);
//     camera.position.set(0, 8, 12);

//     cameraControls = new THREE.OrbitControls(camera, renderer.domElement);
//     cameraControls.enabled = false;
//     cameraControls.enableKeys = false;
//     cameraControls.enableDamping = true;
//     cameraControls.minDistance = 3;
//     cameraControls.maxDistance = 110;
//     cameraControls.maxPolarAngle = Math.PI / 2.05;

//     window.addEventListener('resize', updateAspectRatio);

//     window.addEventListener('keydown', function(event) {
//         var k = event.key.toLowerCase();
//         if (!partidaIniciada) return;

//         if (event.code === 'Space' || event.key.indexOf('Arrow') === 0) {
//             event.preventDefault();
//         }

//         if (k === 'c' && !event.repeat) cambiarCamara();
//         if (k === 'r' && !event.repeat) reiniciarJuego();

//         if (event.code === 'Space' && !event.repeat && estado === 'jugando' && enSuelo) {
//             velocidadVertical = impulsoSalto;
//             enSuelo = false;
//         }

//         teclas[k] = true;
//     });

//     window.addEventListener('keyup', function(event) {
//         teclas[event.key.toLowerCase()] = false;
//     });

//     window.addEventListener('blur', function() {
//         teclas = {};
//     });
// }

// function material(color, extra) {
//     return new THREE.MeshStandardMaterial(
//         Object.assign({ color: color, roughness: 0.55 }, extra || {})
//     );
// }

// function caja(x, y, z, ancho, alto, fondo, mat, grupo) {
//     var m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), mat);
//     m.position.set(x, y, z);
//     m.castShadow = true;
//     m.receiveShadow = true;
//     (grupo || scene).add(m);
//     return m;
// }

// function obstaculo(x, z, ancho, alto, fondo, color, plataforma) {
//     var m = caja(
//         x, alto / 2, z, ancho, alto, fondo,
//         material(color), grupoObstaculos
//     );

//     // Todos los obstáculos sólidos tienen superficie superior.
//     objetosSuelo.push(m);
//     // IMPORTANTE: devolver el objeto 3D creado.
//     return m
// }



// function loadScene() {

//     scene.add(grupoObstaculos);

//     scene.background = new THREE.Color(0x090b1c);
//     scene.fog = new THREE.Fog(0x090b1c, 110, 310);

//     // ILUMINACIÓN GENERAL
//     scene.add(
//         new THREE.HemisphereLight(0x9bc8ff, 0x302040, 1.6)
//     );

//     var luzPrincipal = new THREE.DirectionalLight(0xffffff, 0.8);
//     luzPrincipal.position.set(-30, 60, 20);
//     scene.add(luzPrincipal);

//     // MATERIALES
//     var negro = material(0x151525, { roughness: 0.65 });
//     var violeta = material(0x35214f, { roughness: 0.5 });
//     var azul = material(0x164d75, { metalness: 0.35 });
//     var rosa = material(0xa43b78, { metalness: 0.3 });
//     var gris = material(0x35394a);
//     var blanco = material(0xc4eaff);

//     var neonAzul = new THREE.MeshBasicMaterial({
//         color: 0x35cfff
//     });

//     var neonRosa = new THREE.MeshBasicMaterial({
//         color: 0xff3eac
//     });

//     var neonVioleta = new THREE.MeshBasicMaterial({
//         color: 0x976aff
//     });

//     // FUNCIÓN PARA AÑADIR LUCES
//     function ponerLuz(x, y, z, color, intensidad, alcance) {
//         var luz = new THREE.PointLight(
//             color, intensidad, alcance, 2
//         );

//         luz.position.set(x, y, z);
//         scene.add(luz);

//         lucesAnimadas.push({
//             luz: luz,
//             fase: lucesAnimadas.length * 0.7
//         });
//     }

//     // FUNCIÓN PARA CREAR UN CARTEL CON TEXTO
//     function cartel(texto, x, y, z, ancho, color) {
//         var canvas = document.createElement('canvas');
//         canvas.width = 512;
//         canvas.height = 128;

//         var ctx = canvas.getContext('2d');
//         ctx.clearRect(0, 0, 512, 128);

//         ctx.fillStyle = color;
//         ctx.font = 'bold 58px Arial';
//         ctx.textAlign = 'center';
//         ctx.textBaseline = 'middle';
//         ctx.fillText(texto, 256, 64);

//         var textura = new THREE.CanvasTexture(canvas);

//         var plano = new THREE.Mesh(
//             new THREE.PlaneGeometry(ancho, ancho / 4),
//             new THREE.MeshBasicMaterial({
//                 map: textura,
//                 transparent: true,
//                 side: THREE.DoubleSide,
//                 depthWrite: false
//             })
//         );

//         plano.position.set(x, y, z);
//         scene.add(plano);

//         return plano;
//     }

//     // ============================================
//     // SUELO Y PERÍMETRO
//     // ============================================

//     var suelo = caja(
//         0, -0.5, 0,
//         anchoMundo, 1, fondoMundo,
//         material(0x171629, {
//             roughness: 0.55,
//             metalness: 0.15
//         })
//     );

//     objetosSuelo.push(suelo);

//     // Líneas discretas en el suelo
//     var matCuadricula = new THREE.MeshBasicMaterial({
//         color: 0x292d4e
//     });

//     for (var x = -90; x <= 90; x += 10) {
//         caja(x, 0.012, 0, 0.035, 0.02, 140, matCuadricula);
//     }

//     for (var z = -70; z <= 70; z += 10) {
//         caja(0, 0.013, z, 180, 0.02, 0.035, matCuadricula);
//     }

//     // Límites transparentes, sin líneas decorativas
//     var matPared = material(0x202442, {
//         transparent: true,
//         opacity: 0.055,
//         depthWrite: false,
//         side: THREE.DoubleSide
//     });

//     caja(0, 12, -70.2, 180, 24, 0.3, matPared);
//     caja(0, 12, 70.2, 180, 24, 0.3, matPared);
//     caja(-90.2, 12, 0, 0.3, 24, 140, matPared);
//     caja(90.2, 12, 0, 0.3, 24, 140, matPared);

//     // No creamos techo: así no tapa las cámaras.

//     // ============================================
//     // ZONA 1: BARRA PRINCIPAL
//     // ============================================

//     // Tarima que identifica la zona de barra
//     caja(-58, 0.025, -43, 54, 0.05, 42,
//          material(0x1a3044));

//     // Mostrador largo
//     obstaculo(-58, -35, 37, 2.2, 3.2, 0x325a78, false);

//     // Superficie del mostrador
//     caja(-58, 2.23, -35, 37.5, 0.16, 3.5, blanco);

//     // Luz decorativa frontal
//     caja(-58, 1.1, -33.35, 36, 0.12, 0.08, neonAzul);

//     // Estanterías detrás de la barra
//     for (var nivel = 0; nivel < 3; nivel++) {
//         caja(
//             -58, 2.5 + nivel * 2,
//             -58, 36, 0.3, 2.4, gris
//         );

//         caja(
//             -58, 2.3 + nivel * 2,
//             -56.7, 36, 0.09, 0.09, neonVioleta
//         );
//     }

//     // Botellas sobre las estanterías
//     var coloresBotellas = [
//         0x44e5ff, 0xff5baf, 0xffca55, 0x72ffbd
//     ];

//     for (var b = 0; b < 32; b++) {
//         var bx = -74 + (b % 16) * 2.1;
//         var by = 2.9 + Math.floor(b / 16) * 2;

//         var botella = new THREE.Mesh(
//             new THREE.CylinderGeometry(0.3, 0.38, 1.1, 10),
//             material(coloresBotellas[b % 4], {
//                 transparent: true,
//                 opacity: 0.85
//             })
//         );

//         botella.position.set(bx, by, -58);
//         scene.add(botella);

//         caja(
//             bx, by + 0.68, -58,
//             0.25, 0.25, 0.25, blanco
//         );
//     }

//     // Taburetes delante del mostrador
//     for (var t = 0; t < 7; t++) {
//         var tx = -74 + t * 5;

//         caja(tx, 0.8, -29, 0.25, 1.6, 0.25, gris);
//         caja(tx, 1.65, -29, 2.1, 0.25, 2.1, rosa);
//     }

//     // Máquina de hielo
//     obstaculo(-78, -55, 5, 3.2, 5, 0x68b5d5, false);
//     caja(-78, 3.3, -55, 5.2, 0.2, 5.2, blanco);
//     caja(-78, 2.2, -52.42, 3.2, 0.2, 0.08, neonAzul);

//     // Cartel sobre la barra
//     cartel('LAST ICE BAR', -58, 8, -61, 29, '#69eaff');

//     ponerLuz(-58, 8, -42, 0x22bbff, 2.8, 40);
//     ponerLuz(-78, 5, -55, 0x44ddff, 2.2, 18);

//     // ============================================
//     // ZONA 2: PISTA DE BAILE
//     // ============================================

//     var baldosas = [
//         0x203d68, 0x512b72, 0x632d58,
//         0x20565e, 0x363477
//     ];

//     for (var i = 0; i < 12; i++) {
//         for (var j = 0; j < 11; j++) {
//             var px = -32 + i * 5;
//             var pz = -24 + j * 5;

//             caja(
//                 px, 0.04, pz,
//                 4.7, 0.07, 4.7,
//                 material(baldosas[(i + j) % baldosas.length], {
//                     emissive: baldosas[(i + j) % baldosas.length],
//                     emissiveIntensity: 0.3
//                 })
//             );
//         }
//     }

//     // Cuatro columnas luminosas
//     [
//         [-37, -29],
//         [28, -29],
//         [-37, 31],
//         [28, 31]
//     ].forEach(function(p, i) {
//         obstaculo(p[0], p[1], 2.3, 9, 2.3, 0x34344f, false);

//         caja(
//             p[0], 4.5, p[1] + 1.2,
//             0.22, 8.5, 0.12,
//             i % 2 === 0 ? neonAzul : neonRosa
//         );
//     });

//     // Luces suspendidas sobre la pista
//     for (var f = 0; f < 8; f++) {
//         var fx = -27 + (f % 4) * 16;
//         var fz = -15 + Math.floor(f / 4) * 29;

//         caja(
//             fx, 13, fz,
//             2, 0.5, 2,
//             f % 2 === 0 ? neonRosa : neonAzul
//         );

//         ponerLuz(
//             fx, 11.5, fz,
//             f % 2 === 0 ? 0xff44aa : 0x44aaff,
//             2.1, 23
//         );
//     }

//     // ============================================
//     // ZONA 3: CABINA DEL DJ
//     // ============================================

//     caja(62, 0.18, -30, 38, 0.36, 26, violeta);

//     obstaculo(62, -32, 23, 3, 4, 0x343047, false);

//     caja(62, 3.1, -32, 23, 0.2, 4.3, negro);

//     // Platos de mezcla
//     for (var d = 0; d < 2; d++) {
//         var plato = new THREE.Mesh(
//             new THREE.CylinderGeometry(1.7, 1.7, 0.12, 32),
//             negro
//         );

//         plato.position.set(56 + d * 12, 3.25, -32);
//         scene.add(plato);

//         var aro = new THREE.Mesh(
//             new THREE.TorusGeometry(1.4, 0.09, 8, 40),
//             neonRosa
//         );

//         aro.rotation.x = Math.PI / 2;
//         aro.position.set(56 + d * 12, 3.34, -32);
//         scene.add(aro);
//     }

//     // Altavoces grandes
//     function altavoz(x, z) {
//         obstaculo(x, z, 4, 8, 3, 0x191a28, false);

//         for (var a = 0; a < 2; a++) {
//             var cono = new THREE.Mesh(
//                 new THREE.CylinderGeometry(1.1, 1.1, 0.15, 28),
//                 neonVioleta
//             );

//             cono.rotation.x = Math.PI / 2;
//             cono.position.set(x, 2.5 + a * 3, z + 1.55);
//             scene.add(cono);
//         }
//     }

//     altavoz(43, -40);
//     altavoz(81, -40);

//     cartel('DJ STATION', 62, 10, -44, 23, '#ff63c4');

//     ponerLuz(62, 10, -30, 0xff44aa, 3, 35);

//     // ============================================
//     // ZONA 4: VIP
//     // ============================================

//     caja(-55, 0.025, 46, 60, 0.05, 38,
//          material(0x352447));

//     cartel('VIP LOUNGE', -55, 8, 64, 28, '#e69bff');

//     // Sofás y mesas VIP
//     function sofa(x, z, color) {
//         obstaculo(x, z, 9, 1.3, 3, color, false);
//         obstaculo(x, z + 1.8, 9, 2.7, 0.8, color, false);

//         // Reposabrazos
//         obstaculo(x - 4.3, z, 0.7, 2, 3, color, false);
//         obstaculo(x + 4.3, z, 0.7, 2, 3, color, false);
//     }

//     sofa(-72, 41, 0x724e92);
//     sofa(-51, 41, 0x724e92);
//     sofa(-30, 41, 0x724e92);

//     for (var v = 0; v < 3; v++) {
//         var vx = -72 + v * 21;

//         obstaculo(vx, 49, 4, 1.1, 4, 0x4d638b, false);
//         caja(vx, 1.13, 49, 4.3, 0.12, 4.3, blanco);
//     }

//     ponerLuz(-55, 8, 47, 0xbb55ff, 3, 38);

//     // ============================================
//     // ZONA 5: LOUNGE Y DESCANSO
//     // ============================================

//     caja(58, 0.025, 47, 55, 0.05, 38,
//          material(0x173e43));

//     cartel('CHILL ZONE', 58, 8, 64, 25, '#71ffe5');

//     // Mesas redondas
//     function mesaRedonda(x, z) {
//         var pie = new THREE.Mesh(
//             new THREE.CylinderGeometry(0.22, 0.35, 1.4, 16),
//             gris
//         );

//         pie.position.set(x, 0.7, z);
//         scene.add(pie);

//         var tablero = new THREE.Mesh(
//             new THREE.CylinderGeometry(2.1, 2.1, 0.2, 32),
//             azul
//         );

//         tablero.position.set(x, 1.5, z);
//         scene.add(tablero);
//     }

//     [
//         [44, 38],
//         [68, 38],
//         [44, 56],
//         [68, 56]
//     ].forEach(function(p) {
//         mesaRedonda(p[0], p[1]);
//     });

//     // Máquina refrigeradora del lounge
//     obstaculo(80, 58, 5, 4, 5, 0x448ba5, false);
//     caja(80, 2.4, 60.55, 3.4, 1.8, 0.1, neonAzul);

//     ponerLuz(58, 8, 48, 0x44ffcc, 2.5, 36);

//     // ============================================
//     // BEBIDAS Y ZONAS TÉRMICAS
//     // ============================================

//     // Cinco bebidas distribuidas por el escenario
//     crearCubata(-48, -23, 0); // Barra
//     crearCubata(16, -4, 0);   // Pista de baile
//     crearCubata(76, -20, 0);  // DJ
//     crearCubata(-52, 55, 0);  // VIP
//     crearCubata(58, 47, 0);   // Lounge

//     // Zonas frías
//     crearZona(-78, -48, 5, 'fria');
//     crearZona(79, 49, 5, 'fria');
//     crearZona(-17, 52, 4, 'fria');

//     // Zonas calientes
//     crearZona(0, 0, 6, 'caliente');
//     crearZona(23, 16, 5, 'caliente', 4, 0, 0.5);
//     crearZona(60, -20, 4, 'caliente');

//     // ============================================
//     // OBSTÁCULOS MÓVILES
//     // ============================================

//     // Algunos obstáculos en la pista de baile.
//     // No llenamos toda la discoteca de cubos.
//     crearObstaculoMovil(-15, 12, 5, 0, 0.8);
//     crearObstaculoMovil(9, -15, 0, 5, 0.7);
//     crearObstaculoMovil(30, 6, 0, 4, 0.9);

//     // ============================================
//     // PERSONAJE
//     // ============================================

//     crearPersonaje();


//     // ============================================
//     // MODELOS GLTF
//     // ============================================

//     // Clientes junto a la barra
//     cargarModelo(
//         'models/boy/scene.gltf',
//         -48, -25, 2.4, 1, Math.PI
//     );

//     cargarModelo(
//         'models/boy/scene.gltf',
//         -61, -25, 2.4, 1, Math.PI
//     );

//     cargarModelo(
//         'models/boy/scene.gltf',
//         -35, -25, 2.4, 1, Math.PI
//     );

//     // Clientes en la zona VIP
//     cargarModelo(
//         'models/boy/scene.gltf',
//         -65, 35, 2.4, 1, 0
//     );

//     cargarModelo(
//         'models/boy/scene.gltf',
//         -42, 35, 2.4, 1, 0
//     );

//     // Mesas altas con sillas en zonas abiertas
//     [
//         [-77, -12],
//         [-57, -12],
//         [-37, -12],
//         [40, 42],
//         [66, 42],
//         [55, 60]
//     ].forEach(function(p) {
//         cargarModelo(
//             'models/mesa/scene.gltf',
//             p[0], p[1], 2.5, 1, 0
//         );
//     });

//     // Latas decorativas en la barra
//     cargarModelo(
//         'models/latas/scene.gltf',
//         -68, -35, 0.7, 1, 0
//     );

// }



// function crearZona(x, z, radio, tipo, ax, az, rapidez) {
//     var color = tipo === 'fria' ? 0x40baff : 0xff713e;

//     var grupo = new THREE.Group();
//     grupo.position.set(x, 0, z);
//     scene.add(grupo);

//     var disco = new THREE.Mesh(
//         new THREE.CylinderGeometry(radio, radio, 0.035, 48),
//         new THREE.MeshBasicMaterial({
//             color: color,
//             transparent: true,
//             opacity: 0.34,
//             depthWrite: false
//         })
//     );

//     disco.position.y = 0.035;
//     grupo.add(disco);

//     var aro = new THREE.Mesh(
//         new THREE.TorusGeometry(radio, 0.07, 8, 60),
//         new THREE.MeshBasicMaterial({ color: color })
//     );

//     aro.rotation.x = Math.PI / 2;
//     aro.position.y = 0.07;
//     grupo.add(aro);

//     var luz = new THREE.PointLight(color, 0.8, radio * 3);
//     luz.position.y = 1.3;
//     grupo.add(luz);

//     zonasTermicas.push({
//         x: x,
//         z: z,
//         baseX: x,
//         baseZ: z,
//         radio: radio,
//         tipo: tipo,
//         aro: aro,
//         grupo: grupo,
//         luz: luz,
//         ax: ax || 0,
//         az: az || 0,
//         rapidez: rapidez || 0
//     });
// }    

// function crearPersonaje() {
//     personaje = new THREE.Group();

//     materialHielo = material(0x83e6ff, {
//         transparent: true,
//         opacity: 0.84,
//         roughness: 0.16,
//         metalness: 0.08
//     });

//     var matExtremidades = material(0x43a9d2);
//     var matOjos = new THREE.MeshBasicMaterial({ color: 0x10152c });

//     cuerpoHielo = caja(
//         0, 0.8, 0, 1, 1, 1,
//         materialHielo, personaje
//     );

//     function extremidad(x, y, w, h) {
//         var g = new THREE.Group();
//         g.position.set(x, y, 0);

//         caja(0, -h / 2, 0, w, h, w, matExtremidades, g);
//         personaje.add(g);

//         return g;
//     }

//     brazoIzquierdo = extremidad(-0.58, 0.95, 0.2, 0.6);
//     brazoDerecho = extremidad(0.58, 0.95, 0.2, 0.6);
//     piernaIzquierda = extremidad(-0.25, 0.35, 0.2, 0.35);
//     piernaDerecha = extremidad(0.25, 0.35, 0.2, 0.35);

//     // Ojos
//     [-0.2, 0.2].forEach(function(px) {
//         var ojo = new THREE.Mesh(
//             new THREE.SphereGeometry(0.09, 16, 12),
//             matOjos
//         );

//         ojo.position.set(px, 0.95, 0.51);
//         personaje.add(ojo);
//     });

//     // Sonrisa
//     var sonrisa = new THREE.Mesh(
//         new THREE.TorusGeometry(0.12, 0.017, 6, 18, Math.PI),
//         matOjos
//     );

//     sonrisa.rotation.z = Math.PI;
//     sonrisa.position.set(0, 0.68, 0.515);
//     personaje.add(sonrisa);

//     scene.add(personaje);
// }

// function crearCubata(x, z, altura) {
//     var g = new THREE.Group();

//     var vidrio = material(0xb7edff, {
//         transparent: true,
//         opacity: 0.4,
//         roughness: 0.1,
//         metalness: 0.1,
//         side: THREE.DoubleSide,
//         depthWrite: false
//     });

//     var vaso = new THREE.Mesh(
//         new THREE.CylinderGeometry(0.44, 0.34, 0.95, 24, 1, true),
//         vidrio
//     );
//     vaso.position.y = 0.52;
//     g.add(vaso);

//     var liquido = new THREE.Mesh(
//         new THREE.CylinderGeometry(0.385, 0.335, 0.58, 24),
//         material(0xffad4b, { transparent: true, opacity: 0.75 })
//     );
//     liquido.position.y = 0.35;
//     g.add(liquido);

//     var borde = new THREE.Mesh(
//         new THREE.TorusGeometry(0.44, 0.035, 8, 24),
//         material(0xe7ffff, {
//             emissive: 0x44bbee,
//             emissiveIntensity: 0.5
//         })
//     );
//     borde.rotation.x = Math.PI / 2;
//     borde.position.y = 0.99;
//     g.add(borde);

//     var pajita = new THREE.Mesh(
//         new THREE.CylinderGeometry(0.035, 0.035, 1.25, 10),
//         material(0xff55b5)
//     );
//     pajita.position.set(0.18, 1.04, 0);
//     pajita.rotation.z = 0.22;
//     g.add(pajita);

//     var halo = new THREE.Mesh(
//         new THREE.TorusGeometry(0.78, 0.045, 8, 40),
//         new THREE.MeshBasicMaterial({ color: 0xffd978 })
//     );
//     halo.rotation.x = Math.PI / 2;
//     halo.position.y = 0.08;
//     g.add(halo);

//     g.position.set(x, altura || 0, z);
//     scene.add(g);

//     cubatas.push({
//         grupo: g,
//         x: x,
//         z: z,
//         altura: altura || 0,
//         recogido: false,
//         halo: halo
//     });
// }


// function crearInterfaz() {
//     var style = document.createElement('style');

//     style.textContent = `
//         #lastice-hud {
//             position: fixed;
//             bottom: 18px;
//             left: 50%;
//             transform: translateX(-50%);
//             z-index: 10;
//             display: flex;
//             align-items: center;
//             gap: 24px;
//             padding: 10px 20px;
//             background: rgba(13, 10, 29, 0.82);
//             border: 1px solid #6ac9f0;
//             border-radius: 30px;
//             color: white;
//             font: 600 16px Arial, sans-serif;
//             white-space: nowrap;
//             pointer-events: none;
//         }

//         #lastice-hud .bar {
//             width: 130px;
//             height: 12px;
//             background: #49314c;
//             border-radius: 10px;
//             overflow: hidden;
//         }

//         #lastice-hud .fill {
//             height: 100%;
//             background: #65e0ff;
//         }

//         #lastice-final {
//             display: none;
//             position: fixed;
//             inset: 0;
//             z-index: 20;
//             align-items: center;
//             justify-content: center;
//             background: #070712b8;
//             color: white;
//             font-family: Arial, sans-serif;
//             text-align: center;
//         }

//         #lastice-final .panel {
//             padding: 35px 45px;
//             background: #201b36;
//             border: 2px solid #77dbff;
//             border-radius: 18px;
//         }
//     `;

//     document.head.appendChild(style);

//     hud = document.createElement('div');
//     hud.id = 'lastice-hud';
//     document.body.appendChild(hud);

//     mensajeFinal = document.createElement('div');
//     mensajeFinal.id = 'lastice-final';

//     mensajeFinal.innerHTML =
//         '<div class="panel">' +
//         '<h1 id="lastice-titulo"></h1>' +
//         '<p id="lastice-detalle"></p>' +
//         '<p>Pulsa <b>R</b> para volver a jugar</p>' +
//         '</div>';

//     document.body.appendChild(mensajeFinal);

//     actualizarHUD('');
// }

// function actualizarHUD(zona) {
//     if (!hud) return;

//     var min = Math.floor(Math.max(0, tiempoRestante) / 60);
//     var seg = Math.floor(Math.max(0, tiempoRestante) % 60);

//     var t = min + ':' + (seg < 10 ? '0' : '') + seg;

//     var color = hielo < 30 ? '#ff6a77' : '#65e0ff';

//     hud.innerHTML =
//         '<span>🥤 ' + vasosRecogidos + '/' + objetivoVasos + '</span>' +
//         '<span>⏱ ' + t + '</span>' +
//         '<span>🧊</span>' +
//         '<div class="bar">' +
//         '<div class="fill" style="width:' + hielo +
//         '%;background:' + color + '"></div>' +
//         '</div>';
// }


// function reiniciarJuego() {
//     if (!personaje) return;

//     personaje.position.set(-69, 0, -22);
//     personaje.rotation.set(0, 0, 0);
//     personaje.scale.set(1, 1, 1);

//     velocidadVertical = 0;
//     enSuelo = true;
//     tiempoUltimoGolpe = -100;

//     hielo = 100;
//     tiempoRestante = duracion;
//     vasosRecogidos = 0;
//     estado = 'jugando';
//     teclas = {};

//     cubatas.forEach(function(c) {
//         c.recogido = false;
//         c.grupo.visible = true;
//     });

//     if (mensajeFinal) {
//         mensajeFinal.style.display = 'none';
//     }

//     modoCamara = 0;
//     camaraIniciada = false;
//     cameraControls.enabled = false;

//     actualizarHUD('');
// }

// function terminarJuego(victoria) {
//     if (estado !== 'jugando') return;

//     estado = victoria ? 'victoria' : 'derrota';

//     document.getElementById('lastice-titulo').textContent =
//         victoria ? '¡VICTORIA! 🥤' : 'FIN DE LA PARTIDA 🧊';

//     document.getElementById('lastice-detalle').textContent =
//         victoria ?
//         'Has enfriado los cinco cubatas. ¡Misión cumplida!' :
//         (hielo <= 0 ?
//          'Te has derretido antes de terminar.' :
//          'Se ha agotado el tiempo.');

//     mensajeFinal.style.display = 'flex';
// }

// function cajaColision(x, z) {
//     return new THREE.Box3(
//         new THREE.Vector3(
//             x - mitadAnchura,
//             personaje.position.y + 0.06,
//             z - mitadProfundidad
//         ),
//         new THREE.Vector3(
//             x + mitadAnchura,
//             personaje.position.y + alturaPersonaje,
//             z + mitadProfundidad
//         )
//     );
// }

// function puedeMoverse(x, z) {
//     var actual = cajaColision(
//         personaje.position.x,
//         personaje.position.z
//     );

//     var siguiente = cajaColision(x, z);
//     var permitido = true;

//     grupoObstaculos.updateMatrixWorld(true);

//     grupoObstaculos.children.forEach(function(m) {
//         if (!m.isMesh) return;

//         var cajaO = new THREE.Box3().setFromObject(m);

//         if (!siguiente.intersectsBox(cajaO)) return;

//         if (!actual.intersectsBox(cajaO)) {
//             permitido = false;
//             return;
//         }

//         // Permitir salir de una superposicion existente
//         var a = actual.clone()
//             .intersect(cajaO)
//             .getSize(new THREE.Vector3());

//         var b = siguiente.clone()
//             .intersect(cajaO)
//             .getSize(new THREE.Vector3());

//         if (b.x * b.y * b.z > a.x * a.y * a.z + 0.0000001) {
//             permitido = false;
//         }
//     });

//     return permitido;
// }



// function superficiesBajoPersonaje() {
//     var resultado = [{ altura: 0 }];

//     grupoObstaculos.updateMatrixWorld(true);

//     objetosSuelo.forEach(function(m) {
//         if (m === objetosSuelo[0]) return;

//         var b = new THREE.Box3().setFromObject(m);

//         // Comprobamos el centro del personaje sobre el objeto.
//         if (
//             personaje.position.x >= b.min.x + 0.05 &&
//             personaje.position.x <= b.max.x - 0.05 &&
//             personaje.position.z >= b.min.z + 0.05 &&
//             personaje.position.z <= b.max.z - 0.05
//         ) {
//             resultado.push({ altura: b.max.y });
//         }
//     });

//     return resultado;
// }


// function actualizarSalto(delta) {
//     var pieAnterior = personaje.position.y;
//     var superficies = superficiesBajoPersonaje();
//     var apoyo = -Infinity;

//     superficies.forEach(function(s) {
//         if (s.altura <= pieAnterior + 0.025) {
//             apoyo = Math.max(apoyo, s.altura);
//         }
//     });

//     if (enSuelo && Math.abs(pieAnterior - apoyo) > 0.035) {
//         enSuelo = false;
//         velocidadVertical = 0;
//     }

//     if (enSuelo) {
//         personaje.position.y = apoyo;
//         return;
//     }

//     velocidadVertical += gravedad * delta;

//     var pieNuevo = pieAnterior + velocidadVertical * delta;

//     if (velocidadVertical <= 0) {
//         var aterrizaje = -Infinity;

//         superficies.forEach(function(s) {
//             if (
//                 pieAnterior >= s.altura - 0.025 &&
//                 pieNuevo <= s.altura
//             ) {
//                 aterrizaje = Math.max(aterrizaje, s.altura);
//             }
//         });

//         if (aterrizaje > -Infinity) {
//             personaje.position.y = aterrizaje;
//             velocidadVertical = 0;
//             enSuelo = true;
//             return;
//         }
//     }

//     personaje.position.y = pieNuevo;
// }



// function update(delta) {
//     if (partidaIniciada && estado === 'jugando') {
//         var tMov = clock.elapsedTime;
//         var anteriorX = personaje.position.x;
//         var anteriorZ = personaje.position.z;

//         obstaculosMoviles.forEach(function(o, i) {
//             o.anteriorX = o.m.position.x;
//             o.anteriorZ = o.m.position.z;
//             o.m.position.x =
//                 o.x + o.ax * Math.sin(tMov * o.rapidez + i);

//             o.m.position.z =
//                 o.z + o.az * Math.sin(tMov * o.rapidez + i);
//         });

//         zonasTermicas.forEach(function(z, i) {
//             z.x = z.baseX + z.ax * Math.sin(tMov * z.rapidez + i);
//             z.z = z.baseZ + z.az * Math.sin(tMov * z.rapidez + i);

//             z.grupo.position.set(z.x, 0, z.z);
//         });


//         var dx = 0;
//         var dz = 0;

//         if (modoCamara === 1) {

//             // MODO TRON: conducción.
//             // A y D giran, W y S avanzan o retroceden.

//             var giro =
//                 (teclas['d'] || teclas['arrowright'] ? 1 : 0) -
//                 (teclas['a'] || teclas['arrowleft'] ? 1 : 0);

//             personaje.rotation.y += giro * velocidadGiro * delta;

//             var avance =
//                 (teclas['w'] || teclas['arrowup'] ? 1 : 0) -
//                 (teclas['s'] || teclas['arrowdown'] ? 1 : 0);

//             dx = Math.sin(personaje.rotation.y) * avance;
//             dz = Math.cos(personaje.rotation.y) * avance;

//         } else {

//             // CÁMARAS NORMAL Y PANORÁMICA:
//             // Movimiento en los ejes del escenario.

//             dx =
//                 (teclas['d'] || teclas['arrowright'] ? 1 : 0) -
//                 (teclas['a'] || teclas['arrowleft'] ? 1 : 0);

//             dz =
//                 (teclas['s'] || teclas['arrowdown'] ? 1 : 0) -
//                 (teclas['w'] || teclas['arrowup'] ? 1 : 0);
//         }

//         var moviendo = dx !== 0 || dz !== 0;

//         if (moviendo) {

//             var len = Math.sqrt(dx * dx + dz * dz);
//             dx /= len;
//             dz /= len;

//             var paso = velocidad * delta;

//             var nuevoX = THREE.MathUtils.clamp(
//                 personaje.position.x + dx * paso,
//                 -88.5,
//                 88.5
//             );

//             if (puedeMoverse(nuevoX, personaje.position.z)) {
//                 personaje.position.x = nuevoX;
//             }

//             var nuevoZ = THREE.MathUtils.clamp(
//                 personaje.position.z + dz * paso,
//                 -68.5,
//                 68.5
//             );

//             if (puedeMoverse(personaje.position.x, nuevoZ)) {
//                 personaje.position.z = nuevoZ;
//             }

//             // En modo TRON la orientación la controlan A y D.
//             if (modoCamara !== 1) {
//                 personaje.rotation.y = Math.atan2(dx, dz);
//             }

//             tiempoAnimacion += delta * 11;
//         }


//         var oscilacion = moviendo ?
//             Math.sin(tiempoAnimacion) * 0.5 : 0;

//         piernaIzquierda.rotation.x = oscilacion;
//         piernaDerecha.rotation.x = -oscilacion;
//         brazoIzquierdo.rotation.x = -oscilacion;
//         brazoDerecho.rotation.x = oscilacion;

//         actualizarSalto(delta);
//         comprobarChoquesMoviles(tMov, anteriorX, anteriorZ);

//         var zona = '';

//         zonasTermicas.forEach(function(z) {
//             var d = Math.hypot(
//                 personaje.position.x - z.x,
//                 personaje.position.z - z.z
//             );

//             if (d < z.radio && personaje.position.y < 1.1) {
//                 zona = z.tipo;
//             }
//         });

//         hielo += (
//             zona === 'fria' ? 7 :
//             zona === 'caliente' ? -2.5 : -0.65
//         ) * delta;

//         hielo = THREE.MathUtils.clamp(hielo, 0, 100);
//         tiempoRestante = Math.max(0, tiempoRestante - delta);

//         var escala = 0.25 + 0.75 * hielo / 100;
//         materialHielo.opacity = 0.35 + 0.49 * hielo / 100;
//         personaje.scale.set(escala, escala, escala);

//         cubatas.forEach(function(c) {
//             var distancia = Math.hypot(
//                 personaje.position.x - c.x,
//                 personaje.position.z - c.z
//             );

//             if (
//                 !c.recogido &&
//                 distancia < 0.95 &&
//                 Math.abs(personaje.position.y - c.altura) < 0.55
//             ) {
//                 c.recogido = true;
//                 c.grupo.visible = false;
//                 vasosRecogidos++;
//                 hielo = Math.min(100, hielo + 12);
//             }
//         });

//         actualizarHUD(zona);

//         if (vasosRecogidos >= objetivoVasos) {
//             terminarJuego(true);
//         }
//         else if (hielo <= 0 || tiempoRestante <= 0) {
//             terminarJuego(false);
//         }
//     }

//     var t = clock.elapsedTime;

//     cubatas.forEach(function(c, i) {
//         if (!c.recogido) {
//             c.grupo.rotation.y =
//                 Math.sin(t * 1.4 + i) * 0.18;

//             c.halo.scale.setScalar(
//                 1 + 0.07 * Math.sin(t * 3 + i)
//             );
//         }
//     });

//     lucesAnimadas.forEach(function(l) {
//         l.luz.intensity =
//             1.35 + 0.65 * Math.sin(t * 1.9 + l.fase);
//     });

//     zonasTermicas.forEach(function(z, i) {
//         z.aro.scale.setScalar(
//             1 + 0.02 * Math.sin(t * 2 + i)
//         );
//     });

//     updateCamera(delta);
// }


// function actualizarResorte(actual, vel, objetivo, delta) {
//     aceleracionCamara.copy(objetivo)
//         .sub(actual)
//         .multiplyScalar(rigidezCamara);

//     aceleracionCamara.addScaledVector(
//         vel, -amortiguacionCamara
//     );

//     vel.addScaledVector(aceleracionCamara, delta);
//     actual.addScaledVector(vel, delta);
// }


// function updateCamera(delta) {

//     if (modoCamara === 0) {

//         // CÁMARA NORMAL: elevada y siguiendo al cubito.
//         posicionObjetivoCamara.copy(personaje.position)
//             .add(new THREE.Vector3(0, 10, 14));

//         miradaObjetivoCamara.copy(personaje.position);
//         miradaObjetivoCamara.y += 0.7;

//     } else if (modoCamara === 1) {

//         // CÁMARA TRON: detrás del cubito.
//         var angulo = personaje.rotation.y;
//         var distancia = 8;
//         var altura = 4.5;

//         posicionObjetivoCamara.set(
//             personaje.position.x - Math.sin(angulo) * distancia,
//             personaje.position.y + altura,
//             personaje.position.z - Math.cos(angulo) * distancia
//         );

//         miradaObjetivoCamara.copy(personaje.position);
//         miradaObjetivoCamara.y += 1;

//     } else {

//         // PANORÁMICA: centrada en toda la discoteca.
//         posicionObjetivoCamara.set(0, 165, 95);
//         miradaObjetivoCamara.set(0, 0, 0);
//     }

//     if (!camaraIniciada) {
//         camera.position.copy(posicionObjetivoCamara);
//         miradaActualCamara.copy(miradaObjetivoCamara);

//         velocidadCamara.set(0, 0, 0);
//         velocidadMiradaCamara.set(0, 0, 0);

//         camaraIniciada = true;
//     } else {
//         actualizarResorte(
//             camera.position,
//             velocidadCamara,
//             posicionObjetivoCamara,
//             delta
//         );

//         actualizarResorte(
//             miradaActualCamara,
//             velocidadMiradaCamara,
//             miradaObjetivoCamara,
//             delta
//         );
//     }

//     camera.lookAt(miradaActualCamara);
// }
    

// function cambiarCamara() {
//     modoCamara = (modoCamara + 1) % 3;
//     cameraControls.enabled = false;
// }

// function updateAspectRatio() {
//     renderer.setSize(window.innerWidth, window.innerHeight);
//     camera.aspect = window.innerWidth / window.innerHeight;
//     camera.updateProjectionMatrix();
// }

// function render() {
//     requestAnimationFrame(render);

//     var delta = Math.min(clock.getDelta(), 0.05);
//     update(delta);

//     renderer.render(scene, camera);
// }


// function crearObstaculoMovil(x, z, amplitudX, amplitudZ, rapidez) {
//     var m = obstaculo(x, z, 1.25, 1.05, 1.25, 0xe06c9e, false);

//     obstaculosMoviles.push({
//         m: m,
//         x: x,
//         z: z,
//         ax: amplitudX,
//         az: amplitudZ,
//         rapidez: rapidez
//     });
// }


// function comprobarChoquesMoviles(tiempoActual, anteriorX, anteriorZ) {
//     var cajaJugador = cajaColision(
//         personaje.position.x,
//         personaje.position.z
//     );

//     var choque = false;

//     obstaculosMoviles.forEach(function(o) {
//         var cajaMovil = new THREE.Box3().setFromObject(o.m);

//         if (cajaJugador.intersectsBox(cajaMovil)) {
//             choque = true;

//             // El obstáculo retrocede si alcanza al personaje.
//             if (o.anteriorX !== undefined) {
//                 o.m.position.x = o.anteriorX;
//                 o.m.position.z = o.anteriorZ;
//                 o.m.updateMatrixWorld(true);
//             }
//         }
//     });

//     if (!choque) return;

//     // Recuperamos la posición anterior del jugador.
//     personaje.position.x = anteriorX;
//     personaje.position.z = anteriorZ;

//     // Evitar que un mismo contacto quite hielo cada fotograma.
//     if (tiempoActual - tiempoUltimoGolpe > 1.2) {
//         hielo = Math.max(0, hielo - penalizacionGolpe);
//         tiempoUltimoGolpe = tiempoActual;
//     }
// }



// function crearPantallaInicio() {

//     pantallaInicio = document.createElement('div');
//     pantallaInicio.id = 'pantalla-inicio';

//     pantallaInicio.style.cssText = `
//         position: fixed;
//         inset: 0;
//         z-index: 100;
//         display: flex;
//         align-items: center;
//         justify-content: center;
//         background: rgba(6, 8, 23, 0.94);
//         color: white;
//         font-family: Arial, sans-serif;
//         text-align: center;
//     `;

//     pantallaInicio.innerHTML = `
//         <div style="
//             width: min(520px, 88vw);
//             padding: 42px 35px;
//             border: 2px solid #65e0ff;
//             border-radius: 20px;
//             background: #15162c;
//             box-shadow: 0 0 50px #225d88;
//         ">

//             <h1 style="
//                 font-size: 64px;
//                 color: #65e0ff;
//                 margin: 0;
//                 text-shadow: 0 0 20px #32aaff;
//             ">
//                 LAST ICE
//             </h1>

//             <h2 style="
//                 color: #ff78c4;
//                 font-size: 19px;
//                 margin: 12px 0 25px;
//             ">
//                 LA ÚLTIMA RONDA
//             </h2>

//             <p style="line-height: 1.7;">
//                 Eres un cubito de hielo en una discoteca.
//                 Encuentra las cinco bebidas antes de derretirte.
//                 ¡Evita las zonas calientes y busca refrigeración!
//             </p>

//             <div style="
//                 margin: 25px 0;
//                 padding: 18px;
//                 background: #20243f;
//                 border-radius: 12px;
//                 line-height: 2;
//             ">
//                 <b>WASD / Flechas</b> — Moverse<br>
//                 <b>ESPACIO</b> — Saltar<br>
//                 <b>C</b> — Cambiar cámara<br>
//                 <b>R</b> — Reiniciar
//             </div>

//             <button id="boton-jugar" style="
//                 padding: 15px 55px;
//                 background: #65e0ff;
//                 color: #101426;
//                 border: none;
//                 border-radius: 12px;
//                 font-size: 22px;
//                 font-weight: bold;
//                 cursor: pointer;
//                 box-shadow: 0 0 22px #2699d5;
//             ">
//                 ▶ JUGAR
//             </button>

//         </div>
//     `;

//     document.body.appendChild(pantallaInicio);

//     document.getElementById('boton-jugar')
//         .addEventListener('click', function() {

//             partidaIniciada = true;
//             pantallaInicio.style.display = 'none';

//             reiniciarJuego();
//             clock.getDelta();
//         });
// }



// function cargarModelo(ruta, x, z, altura, escala, rotacion) {

//     var loader = new THREE.GLTFLoader();

//     loader.load(
//         ruta,

//         function(gltf) {

//             var modelo = gltf.scene;

//             // Centramos el modelo horizontalmente.
//             modelo.updateMatrixWorld(true);

//             var cajaModelo = new THREE.Box3().setFromObject(modelo);
//             var centro = cajaModelo.getCenter(new THREE.Vector3());
//             var dimensiones = cajaModelo.getSize(new THREE.Vector3());

//             if (dimensiones.y === 0) return;

//             // Normalizamos el tamaño para que no aparezcan
//             // modelos gigantes o diminutos.
//             var factor = altura / dimensiones.y;
//             modelo.scale.multiplyScalar(factor * escala);

//             modelo.updateMatrixWorld(true);

//             cajaModelo.setFromObject(modelo);
//             centro = cajaModelo.getCenter(new THREE.Vector3());

//             modelo.position.x += x - centro.x;
//             modelo.position.z += z - centro.z;
//             modelo.position.y += -cajaModelo.min.y;

//             modelo.rotation.y += rotacion || 0;

//             modelo.traverse(function(obj) {
//                 if (obj.isMesh) {
//                     obj.castShadow = true;
//                     obj.receiveShadow = true;
//                 }
//             });

//             scene.add(modelo);
//         },

//         undefined,

//         function(error) {
//             console.error('Error cargando modelo:', ruta, error);
//         }
//     );
// }
