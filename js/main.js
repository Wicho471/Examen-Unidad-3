import * as THREE from 'three'; // Importa todas las funciones de la biblioteca Three.js
import Stats from 'three/addons/libs/stats.module.js'; // Importa el módulo Stats para medir el rendimiento
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; // Importa el módulo OrbitControls para controlar la cámara con el ratón
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'; // Importa el módulo FBXLoader para cargar archivos FBX
import { GUI } from 'three/addons/libs/lil-gui.module.min.js'; // Importa el módulo GUI para crear una interfaz de usuario

// Declaración de variables globales
let camera, scene, renderer, stats, loader, guiMorphsFolder;
const clock = new THREE.Clock(); // Reloj para controlar el tiempo en la animación
let mixer; // Mezclador de animaciones
let characterGroup; // Grupo que contendrá el modelo del personaje
let followCamera = true; // Bandera para seguir al personaje con la cámara
let controls;
// Constantes para la velocidad de movimiento del personaje
const normalSpeed = 250; // Velocidad normal
const fastSpeed = 400; // Velocidad rápida
let currentSpeed = normalSpeed; // Velocidad actual del personaje
let isRotating = false;

//Caja de coliciones
let characterBox; // Caja de colisión del personaje
const pyramidBoxes = []; // Arreglo para las cajas de colisión de las pirámides
let previousPosition = new THREE.Vector3(); // Posición anterior del personaje

// Parámetros para la GUI
const params = {
    asset: 'Dancing Twerk' // Animación inicial seleccionada
};

// Lista de activos (animaciones) disponibles
const assets = [
    'Idle',
    'Walking',
    'Walking Backwards',
    'Right Turn',
    'Left Turn',
    'Dancing Twerk',
    'Running',
    'Jump',
    'Catwalk Walk Stop'
];

// Objeto para almacenar las acciones de animación
const actions = {};
let activeAction; // Acción de animación activa
let previousAction; // Acción de animación previa
let stopAction; // Acción de animación de parada
let keyPressed = { w: false, s: false, d: false, a: false }; // Objeto para rastrear las teclas presionadas

// Llama a la función de inicialización
init();

function init() {
    const container = document.createElement('div'); // Crea un contenedor div
    document.body.appendChild(container); // Añade el contenedor al cuerpo del documento

    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 1, 2000); // Crea una cámara de perspectiva
    camera.position.set(150, 250, 350); // Establece la posición inicial de la cámara

    scene = new THREE.Scene(); // Crea una nueva escena
    scene.background = new THREE.Color(0x0096ff); // Establece el color de fondo de la escena
    scene.fog = new THREE.Fog(0x9b9b9b, 500, 1000); // Añade niebla a la escena

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 5); // Crea una luz hemisférica
    hemiLight.position.set(0, 200, 0); // Establece la posición de la luz
    scene.add(hemiLight); // Añade la luz a la escena

    const dirLight = new THREE.DirectionalLight(0x4287f5, 50); // Crea una luz direccional
    dirLight.position.set(0, 200, 100); // Establece la posición de la luz
    dirLight.castShadow = true; // Habilita la proyección de sombras
    dirLight.shadow.camera.top = 180; // Establece los límites de la cámara de sombras
    dirLight.shadow.camera.bottom = -100;
    dirLight.shadow.camera.left = -120;
    dirLight.shadow.camera.right = 120;
    scene.add(dirLight); // Añade la luz a la escena

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshPhongMaterial({ color: 0x008200, depthWrite: false })); // Crea un plano con material phong
    mesh.rotation.x = -Math.PI / 2; // Rota el plano 90 grados en el eje X
    mesh.receiveShadow = true; // Habilita la recepción de sombras
    scene.add(mesh); // Añade el plano a la escena

    const grid = new THREE.GridHelper(5000, 50, 0x000000, 0x000000); // Crea una cuadrícula de ayuda
    grid.material.opacity = 0.2; // Establece la opacidad del material
    grid.material.transparent = true; // Habilita la transparencia del material
    scene.add(grid); // Añade la cuadrícula a la escena
    scene.add(new THREE.AxesHelper());
    loader = new FBXLoader(); // Crea una instancia del cargador FBX
    mixer = new THREE.AnimationMixer(scene); // Crea un mezclador de animaciones para la escena
    loadAssets(); // Llama a la función para cargar los activos

    renderer = new THREE.WebGLRenderer({ antialias: true }); // Crea un renderizador WebGL con antialiasing
    renderer.setPixelRatio(window.devicePixelRatio); // Establece el ratio de píxeles
    renderer.setSize(window.innerWidth, window.innerHeight); // Establece el tamaño del renderizador
    renderer.setAnimationLoop(animate); // Establece la función de animación
    renderer.shadowMap.enabled = true; // Habilita el mapa de sombras
    container.appendChild(renderer.domElement); // Añade el elemento del renderizador al contenedor

    controls = new OrbitControls(camera, renderer.domElement); // Crea los controles de órbita para la cámara
    controls.listenToKeyEvents(window); // Opcional
    controls.enableDamping = true; // Requiere un bucle de animación cuando el damping o la auto-rotación están habilitados
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 100;
    controls.maxDistance = 500;
    controls.maxPolarAngle = Math.PI / 2;

    // Desactivar las interacciones predeterminadas
    controls.enableRotate = false;
    controls.enablePan = false;
    controls.enableZoom = false;

    // Solo permitir la rotación con el clic izquierdo
    renderer.domElement.addEventListener('mousedown', onMouseDown, false);
    renderer.domElement.addEventListener('mouseup', onMouseUp, false);

    function onMouseDown(event) {
        if (event.button === 0) { // 0 es el botón izquierdo del mouse
            isRotating = true; // Usar la variable global isRotating
            controls.enableRotate = true;
            console.log("Mouse precionado");
        }
    }

    function onMouseUp(event) {
        if (event.button === 0) {
            isRotating = false; // Usar la variable global isRotating
            controls.enableRotate = false;
        }
    }

    // Restringir la rotación solo al eje Z
    controls.addEventListener('change', () => {
        if (isRotating) {
            const euler = new THREE.Euler().setFromQuaternion(controls.object.quaternion, 'XYZ');
            controls.object.quaternion.setFromEuler(new THREE.Euler(0, 0, euler.z, 'XYZ'));
        }
    });
    

    window.addEventListener('resize', onWindowResize); // Añade un evento para redimensionar la ventana

    document.addEventListener('keydown', onDocumentKeyDown); // Añade un evento para presionar teclas
    document.addEventListener('keyup', onDocumentKeyUp); // Añade un evento para soltar teclas

    stats = new Stats(); // Crea una instancia de Stats
    container.appendChild(stats.dom); // Añade el elemento Stats al contenedor

    const gui = new GUI(); // Crea una instancia de GUI
    gui.add(params, 'asset', assets); // Añade un control de selección de activos a la GUI
    guiMorphsFolder = gui.addFolder('Morphs').hide(); // Añade una carpeta de morphs a la GUI y la oculta

    const button = document.createElement('button'); // Crea un botón HTML
    button.innerText = 'Toggle Camera Follow'; // Establece el texto del botón
    button.style.position = 'absolute'; // Establece la posición absoluta del botón
    button.style.top = '10px'; // Establece la posición superior del botón
    button.style.right = '10px'; // Establece la posición derecha del botón
    button.addEventListener('click', () => { // Añade un evento de clic al botón
        followCamera = !followCamera; // Alterna la bandera de seguimiento de la cámara
    });
    document.body.appendChild(button); // Añade el botón al cuerpo del documento

    // Genera pirámides aleatorias distribuidas por la superficie
    const numPyramids = 100; // Número de pirámides a generar
    const pyramidSize = 200; // Tamaño de la base de las pirámides

    for (let i = 0; i < numPyramids; i++) { // Itera para crear las pirámides
        const pyramid = new THREE.Mesh(
            new THREE.ConeGeometry(pyramidSize / 2, pyramidSize, 4), // Base y altura de la pirámide, con 4 segmentos
            new THREE.MeshPhongMaterial({ color: 0xff0000 })
        );

        const x = Math.random() * 5000 - 2500; // Coordenada x aleatoria
        const z = Math.random() * 5000 - 2500; // Coordenada z aleatoria
        const y = pyramidSize / 2; // Coordenada y para que la pirámide esté al nivel del suelo

        pyramid.position.set(x, y, z); // Establece la posición de la pirámide
        scene.add(pyramid); // Añade la pirámide a la escena

         // Crea una caja de colisión para la pirámide
         const pyramidBox = new THREE.Box3().setFromObject(pyramid);
         pyramidBox.expandByScalar(-pyramidSize * 0.01); // Reducir el tamaño de la caja de colisión
         pyramidBoxes.push(pyramidBox);
    }
}

function loadAssets() {
    assets.forEach((asset) => { // Itera sobre cada activo en la lista
        loader.load(`models/fbx/${asset}.fbx`, function (group) { // Carga el archivo FBX correspondiente
            if (group.animations && group.animations.length > 0) { // Verifica si hay animaciones
                const action = mixer.clipAction(group.animations[0]); // Obtiene la primera animación del grupo
                actions[asset] = action; // Almacena la acción en el objeto actions

                if (asset === 'Dancing Twerk') { // Si el activo es 'Dancing Twerk'
                    action.play(); // Reproduce la acción
                    activeAction = action; // Establece la acción como activa
                }

                group.traverse(function (child) { // Recorre cada hijo del grupo
                    if (child.isMesh) { // Si el hijo es una malla
                        child.castShadow = true; // Habilita la proyección de sombras
                        child.receiveShadow = true; // Habilita la recepción de sombras
                    }
                });

                if (!characterGroup) { // Si el grupo de personajes no está definido
                    characterGroup = group; // Establece el grupo de personajes
                    scene.add(characterGroup); // Añade el grupo de personajes a la escena
                } else {
                    group.visible = false; // Oculta el grupo adicional
                    characterGroup.add(group); // Añade el grupo al grupo de personajes
                }

            } else {
                console.error(`No animations found for asset: ${asset}`); // Muestra un error si no hay animaciones
            }
        });
    });
}

function switchAnimation(toAction, loop = true) {
    if (toAction && toAction !== activeAction) { // Si la nueva acción es diferente a la acción activa
        if (activeAction) {
            activeAction.fadeOut(0.5); // Atenúa la acción activa
        }

        activeAction = toAction; // Establece la nueva acción como activa

        activeAction.reset(); // Reinicia la acción
        activeAction.fadeIn(0.5); // Atenúa la acción
        activeAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce); // Establece el modo de repetición de la acción
        activeAction.play(); // Reproduce la acción
    }
}

function onDocumentKeyDown(event) {
    keyPressed[event.key.toLowerCase()] = true; // Marca la tecla como presionada

    switch (event.key.toLowerCase()) {
        case 'w':
            switchAnimation(actions['Walking']); // Cambia a la animación de caminar
            break;
        case 's':
            switchAnimation(actions['Walking Backwards']); // Cambia a la animación de caminar hacia atrás
            break;
        case 'd':
            switchAnimation(actions['Walking']); // Cambia a la animación de giro a la derecha
            break;
        case 'a':
            switchAnimation(actions['Walking']); // Cambia a la animación de giro a la izquierda
            break;
        case 'shift':
            currentSpeed = fastSpeed; // Aumenta la velocidad
            switchAnimation(actions['Running']); // Cambia a la animación de correr rápido
            break;
        case '1':
            currentSpeed = fastSpeed; // Aumenta la velocidad
            switchAnimation(actions['Dancing Twerk']); // Cambia a la animación de correr rápido
            break;
        case ' ':
            switchAnimation(actions['Jump']); // Cambia a la animación de salto
            break;
    }
}

function onDocumentKeyUp(event) {
    keyPressed[event.key.toLowerCase()] = false; // Marca la tecla como no presionada
    currentSpeed = normalSpeed; // Restablece la velocidad normal

    if (!keyPressed.w && !keyPressed.s && !keyPressed.d && !keyPressed.a) { // Si ninguna tecla está presionada
        if (!stopAction) {

            stopAction = actions['Idle']; // Establece la acción de parada
            stopAction.loop = THREE.LoopOnce; // Establece el bucle de la acción para ejecutarse una vez
            stopAction.clampWhenFinished = true; // Mantiene la última pose cuando termina
            stopAction.onFinished = function () { // Define lo que sucede cuando termina la acción
                switchAnimation(actions['Idle']); // Cambia a la animación de 'Dancing Twerk'
                stopAction = null; // Restablece la acción de parada
            };
        }
        switchAnimation(stopAction, false); // Cambia a la acción de parada sin bucle
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight; // Actualiza la relación de aspecto de la cámara
    camera.updateProjectionMatrix(); // Actualiza la matriz de proyección de la cámara
    renderer.setSize(window.innerWidth, window.innerHeight); // Actualiza el tamaño del renderizador
}

function animate() {
    const delta = clock.getDelta(); // Obtiene el tiempo transcurrido desde la última llamada

    if (mixer) mixer.update(delta); // Actualiza el mezclador de animaciones

    if (characterGroup) {
        // Guardar la posición anterior del personaje
        previousPosition.copy(characterGroup.position);

        if (keyPressed.w) {
            characterGroup.translateZ(currentSpeed * delta); // Mueve el grupo de personajes hacia adelante
        } else if (keyPressed.s) {
            characterGroup.translateZ(-currentSpeed * delta); // Mueve el grupo de personajes hacia atrás
        } else if (keyPressed.d) {
            characterGroup.rotateY(-Math.PI / 2 * delta); // Rota el grupo de personajes a la derecha
        } else if (keyPressed.a) {
            characterGroup.rotateY(Math.PI / 2 * delta); // Rota el grupo de personajes a la izquierda
        }

        // Actualiza la caja de colisión del personaje
        characterBox = new THREE.Box3().setFromObject(characterGroup);
        characterBox.expandByScalar(-100); // Reducir el tamaño de la caja de colisión del personaje

        // Verifica colisiones con las pirámides
        for (const pyramidBox of pyramidBoxes) {
            if (characterBox.intersectsBox(pyramidBox)) {
                console.log('Colisión detectada con una pirámide!');
                // Revertir la posición del personaje a la anterior en caso de colisión
                characterGroup.position.copy(previousPosition);
                break; // Salir del bucle después de detectar la colisión
            }
        }

        if (followCamera) {
            camera.position.set(
                characterGroup.position.x + 0,
                characterGroup.position.y + 300,
                characterGroup.position.z + -500
            ); // Establece la posición de la cámara para seguir al personaje
            camera.lookAt(characterGroup.position); // La cámara mira hacia el personaje
        }
    }

    renderer.render(scene, camera); // Renderiza la escena desde la perspectiva de la cámara
    controls.update(); // Actualiza los controles
    stats.update(); // Actualiza las estadísticas de rendimiento
}
