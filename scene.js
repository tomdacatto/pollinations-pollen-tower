// The 3D tower: one box per company, an elevator car on the corner, drag to turn.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const FLOOR_H = 1.1;
const WIDTH = 5;

// A small stable number from a string, so every company keeps its own colour and lit windows.
const hash = (text) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

function facade(company) {
    const seed = hash(company.id);
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 128;
    const g = canvas.getContext("2d");
    const hue = seed % 360;
    g.fillStyle = `hsl(${hue} 32% 22%)`;
    g.fillRect(0, 0, canvas.width, canvas.height);
    for (let x = 0; x < 10; x++) {
        for (let y = 0; y < 3; y++) {
            const lit = ((seed >> (x + y * 3)) & 3) !== 0;
            g.fillStyle = lit ? `hsl(${(hue + 40) % 360} 85% ${62 + ((x * y) % 3) * 6}%)` : `hsl(${hue} 20% 14%)`;
            g.fillRect(14 + x * 30, 12 + y * 36, 20, 24);
        }
    }
    g.fillStyle = "rgba(8, 10, 18, 0.82)";
    g.fillRect(0, 40, canvas.width, 48);
    g.fillStyle = "#fff";
    g.font = "bold 30px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(company.name, canvas.width / 2, 65, canvas.width - 24);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export function createTower(canvas, { onPick, onRide }) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1020);
    scene.fog = new THREE.Fog(0x0d1020, 22, 60);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x1b1f33, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(8, 20, 10);
    scene.add(sun);

    const ground = new THREE.Mesh(
        new THREE.CircleGeometry(40, 64),
        new THREE.MeshStandardMaterial({ color: 0x1a1e33, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // The elevator shaft and car sit on the front-right corner.
    const shaft = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 1, 0.16),
        new THREE.MeshStandardMaterial({ color: 0x6b6f8a }),
    );
    const car = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, FLOOR_H * 0.75, 0.55),
        new THREE.MeshStandardMaterial({ color: 0xffc857, emissive: 0xffc857, emissiveIntensity: 0.55 }),
    );
    scene.add(shaft, car);
    const corner = WIDTH / 2 + 0.3;
    shaft.position.set(corner, 0, corner);

    const floors = new THREE.Group();
    scene.add(floors);
    let companies = [];
    let selected = 0;
    let carY = 0;
    let yaw = 0.6;
    let top = 0;

    function setFloors(list, current) {
        for (const mesh of floors.children) {
            for (const material of mesh.material) {
                material.map?.dispose();
                material.dispose();
            }
            mesh.geometry.dispose();
        }
        floors.clear();
        companies = list;
        list.forEach((company, i) => {
            // The same lit facade, with the name, on all four sides.
            const wall = new THREE.MeshStandardMaterial({ map: facade(company), roughness: 0.7 });
            const plain = new THREE.MeshStandardMaterial({ color: 0x2a2f4a });
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(WIDTH, FLOOR_H - 0.08, WIDTH), [
                wall,
                wall,
                plain,
                plain,
                wall,
                wall,
            ]);
            mesh.position.y = i * FLOOR_H + FLOOR_H / 2;
            mesh.userData.index = i;
            floors.add(mesh);
        });
        top = list.length * FLOOR_H;
        shaft.scale.y = top;
        shaft.position.y = top / 2;
        select(current ?? Math.min(selected, list.length - 1));
    }

    function select(index) {
        selected = Math.max(0, Math.min(companies.length - 1, index));
        floors.children.forEach((mesh, i) => {
            for (const material of mesh.material) {
                material.emissive?.setHex(i === selected ? 0x3a3050 : 0x000000);
            }
        });
    }

    function resize() {
        const { clientWidth: w, clientHeight: h } = canvas;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(canvas);
    resize();

    // Drag turns the tower, a click on a floor picks it, the wheel rides the elevator.
    let drag = null;
    let idle = true;
    canvas.addEventListener("pointerdown", (event) => {
        drag = { x: event.clientX, y: event.clientY, moved: 0 };
        idle = false;
        canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
        if (!drag) return;
        yaw -= (event.clientX - drag.x) * 0.008;
        drag.moved += Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y);
        drag.x = event.clientX;
        drag.y = event.clientY;
    });
    canvas.addEventListener("pointerup", (event) => {
        if (drag && drag.moved < 5) {
            const rect = canvas.getBoundingClientRect();
            const pointer = new THREE.Vector2(
                ((event.clientX - rect.left) / rect.width) * 2 - 1,
                -((event.clientY - rect.top) / rect.height) * 2 + 1,
            );
            const ray = new THREE.Raycaster();
            ray.setFromCamera(pointer, camera);
            const hit = ray.intersectObjects(floors.children)[0];
            if (hit) onPick(hit.object.userData.index);
        }
        drag = null;
    });
    canvas.addEventListener(
        "wheel",
        (event) => {
            event.preventDefault();
            onRide(event.deltaY > 0 ? -1 : 1);
        },
        { passive: false },
    );

    renderer.setAnimationLoop(() => {
        if (idle) yaw += 0.0025;
        carY += (selected * FLOOR_H + FLOOR_H / 2 - carY) * 0.08;
        car.position.set(corner, carY, corner);
        const view = Math.max(carY, top / 2);
        const radius = 12 + companies.length * 0.5;
        camera.position.set(Math.sin(yaw) * radius, view + 3, Math.cos(yaw) * radius);
        camera.lookAt(0, view, 0);
        renderer.render(scene, camera);
    });

    return { setFloors, select, stopSpinning: () => (idle = false) };
}
