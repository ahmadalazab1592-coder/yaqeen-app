import React, { useState, useEffect, useRef } from 'react';
import { Moon, MapPin, Globe, Info, Calendar, X, Hourglass, Rotate3D, Star, Quote } from 'lucide-react';

// ==========================================
// 1. المحرك الفلكي الدقيق (خوارزمية Jean Meeus)
// ==========================================
const SYNODIC_MONTH_MS = 29.53058868 * 24 * 60 * 60 * 1000;
const BASE_HIJRI_YEAR = 1447;
const BASE_HIJRI_MONTH = 8; 
const BASE_CONJUNCTION_MS = Date.UTC(2026, 1, 17, 12, 1); 

const HIJRI_MONTHS = [
  "المحرم (رأس السنة)", "صفر", "ربيع الأول", "ربيع الآخر",
  "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان",
  "رمضان (بدء الصيام)", "شوال (عيد الفطر)", "ذو القعدة", "ذو الحجة (عيد الأضحى)"
];

const generateYears = () => {
  const years = [];
  for (let i = BASE_HIJRI_YEAR; i < BASE_HIJRI_YEAR + 50; i++) years.push(i);
  return years;
};

// دالة مساعدة لحساب الجيب بالدرجات
const sinDeg = (deg) => Math.sin(deg * Math.PI / 180.0);

// محرك الحساب الدقيق للاقتران
const getTrueConjunction = (approximateDateMs) => {
    let jdApprox = (approximateDateMs / 86400000.0) + 2440587.5;
    let k = Math.round((jdApprox - 2451550.09766) / 29.530588861);
    
    let T = k / 1236.85;
    let T2 = T * T;
    let T3 = T2 * T;
    let T4 = T3 * T;
    
    let jdMean = 2451550.09766 + 29.530588861 * k 
                + 0.0001337 * T2 
                - 0.000000150 * T3 
                + 0.00000000073 * T4;
    
    let M = 2.5534 + 29.10535670 * k - 0.0000218 * T2 - 0.00000011 * T3;
    let Mprime = 201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3;
    let F = 160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3;
    let OM = 124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3;
    let E = 1 - 0.002516 * T - 0.0000074 * T2;
    
    let correction = 
        -0.40720 * sinDeg(Mprime) 
        + 0.17241 * E * sinDeg(M) 
        + 0.01608 * sinDeg(2 * Mprime) 
        + 0.01039 * sinDeg(2 * F) 
        + 0.00739 * E * sinDeg(Mprime - M) 
        - 0.00514 * E * sinDeg(Mprime + M) 
        + 0.00208 * E * E * sinDeg(2 * M) 
        - 0.00111 * sinDeg(Mprime - 2 * F) 
        - 0.00057 * sinDeg(Mprime + 2 * F) 
        + 0.00056 * E * sinDeg(2 * Mprime + M) 
        - 0.00042 * sinDeg(3 * Mprime) 
        + 0.00042 * E * sinDeg(M + 2 * F) 
        + 0.00038 * E * sinDeg(M - 2 * F) 
        - 0.00024 * E * sinDeg(2 * Mprime - M) 
        - 0.00017 * sinDeg(OM) 
        - 0.00007 * sinDeg(Mprime + 2 * M) 
        + 0.00004 * sinDeg(2 * Mprime - 2 * F) 
        + 0.00004 * sinDeg(3 * M) 
        + 0.00003 * sinDeg(Mprime + M - 2 * F) 
        + 0.00003 * sinDeg(2 * Mprime + 2 * F) 
        - 0.00003 * sinDeg(Mprime + M + 2 * F) 
        + 0.00003 * sinDeg(Mprime - M + 2 * F) 
        - 0.00002 * sinDeg(Mprime - M - 2 * F) 
        - 0.00002 * sinDeg(3 * Mprime + M) 
        + 0.00002 * sinDeg(4 * Mprime);
        
    let jdTrue = jdMean + correction;
    let unixTimeMs = (jdTrue - 2440587.5) * 86400000.0;
    
    return new Date(unixTimeMs);
};

const getConjunctionTime = (hijriYear, monthIndex) => {
  const totalMonthsDiff = ((hijriYear - BASE_HIJRI_YEAR) * 12) + (monthIndex - BASE_HIJRI_MONTH);
  const approximateMs = BASE_CONJUNCTION_MS + (totalMonthsDiff * SYNODIC_MONTH_MS);
  return getTrueConjunction(approximateMs);
};

const getGregorianDateString = (date) => {
  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  }).format(date);
};

export default function YaqeenApp() {
  const [selectedYear, setSelectedYear] = useState(BASE_HIJRI_YEAR);
  const [selectedMonth, setSelectedMonth] = useState(8); 
  const [isManualYear, setIsManualYear] = useState(false); 
  const [userLocation, setUserLocation] = useState(null);
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [threeLoaded, setThreeLoaded] = useState(false);
  
  // حالات الفيديو الترحيبي
  const [showSplash, setShowSplash] = useState(true);
  const [fadeSplash, setFadeSplash] = useState(false);
  
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerInstance = useRef(null);
  const threeCanvasRef = useRef(null);
  const threeSceneRef = useRef(null);
  const resultsRef = useRef(null);
  const availableYears = generateYears();

  const handleVideoEnd = () => {
    setFadeSplash(true);
    setTimeout(() => setShowSplash(false), 800); 
  };

  // ==========================================
  // 2. تحميل المكتبات 
  // ==========================================
  useEffect(() => {
    const loadScript = (src) => new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const script = document.createElement('script');
      script.src = src; script.onload = resolve; script.onerror = reject;
      document.head.appendChild(script);
    });

    const initLibs = async () => {
      if (!document.getElementById('arabic-font-fallback')) {
        const fontLink = document.createElement('link');
        fontLink.id = 'arabic-font-fallback';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
      }

      if (!window.L) {
        const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link);
        await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
      }
      init2DMap();

      if (!window.THREE) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
      if (window.THREE && !window.THREE.OrbitControls) await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
      setThreeLoaded(true);
    };
    initLibs();
  }, []);

  function init2DMap() {
    if (mapInstance.current || !window.L || !mapRef.current) return;
    mapInstance.current = window.L.map(mapRef.current).setView([25, 45], 2);
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '&copy; OpenStreetMap' }).addTo(mapInstance.current);

    mapInstance.current.on('click', (e) => {
      const { lat, lng } = e.latlng;
      setUserLocation({ lat, lng });
      if (markerInstance.current) {
        markerInstance.current.setLatLng([lat, lng]);
      } else {
        const customIcon = window.L.divIcon({
          className: 'custom-pin',
          html: `<div style="background-color: #0d9488; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`,
          iconSize: [16, 16], iconAnchor: [8, 8]
        });
        markerInstance.current = window.L.marker([lat, lng], {icon: customIcon}).addTo(mapInstance.current);
      }
    });
  }

  // ==========================================
  // 3. الحسابات الفلكية
  // ==========================================
  const calculateFajrTime = (lat, lng, date) => {
    const year = date.getUTCFullYear();
    const start = new Date(Date.UTC(year, 0, 0));
    const dayOfYear = Math.floor((date - start) / (1000 * 60 * 60 * 24));
    
    const declination = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * (Math.PI / 180));
    const latRad = lat * (Math.PI / 180);
    const decRad = declination * (Math.PI / 180);
    
    let cosHourAngle = (Math.sin(-18 * (Math.PI / 180)) - Math.sin(latRad) * Math.sin(decRad)) / (Math.cos(latRad) * Math.cos(decRad));
    cosHourAngle = Math.max(-1, Math.min(1, cosHourAngle));
    const hourAngle = Math.acos(cosHourAngle) * (180 / Math.PI);
    
    const equationOfTime = 9.87 * Math.sin(2 * (360/365)*(dayOfYear-81)*(Math.PI/180)) - 7.53 * Math.cos((360/365)*(dayOfYear-81)*(Math.PI/180)) - 1.5 * Math.sin((360/365)*(dayOfYear-81)*(Math.PI/180));
    const solarNoonUTC = 12 - (lng / 15) - (equationOfTime / 60);
    
    const fajrUTC = solarNoonUTC - (hourAngle / 15);
    const resultDate = new Date(date);
    resultDate.setUTCHours(Math.floor(fajrUTC), Math.floor((fajrUTC % 1) * 60), 0, 0);
    return resultDate;
  };

  const performCalculations = () => {
    if (!userLocation || !selectedYear) return;
    setIsLoading(true);

    setTimeout(() => {
      const conjunctionTime = getConjunctionTime(selectedYear, selectedMonth);
      
      let bestLng = 0; let minDifference = Infinity;
      for (let lng = -180; lng <= 180; lng += 1) {
        const diff = Math.abs(calculateFajrTime(0, lng, conjunctionTime).getTime() - conjunctionTime.getTime());
        if (diff < minDifference) { minDifference = diff; bestLng = lng; }
      }
      const startingLng = bestLng;

      let userFajr = calculateFajrTime(userLocation.lat, userLocation.lng, new Date(conjunctionTime));
      let status = "مباشر";
      
      if (userFajr.getTime() < conjunctionTime.getTime()) {
        userFajr = calculateFajrTime(userLocation.lat, userLocation.lng, new Date(conjunctionTime.getTime() + 86400000));
        status = "انتظار دوران الأرض (فجر اليوم التالي)";
      }

      setResults({ conjunctionTime, startingLng, userFajr, status });
      setIsLoading(false);
    }, 600);
  };

  useEffect(() => {
    if (userLocation && selectedYear >= 1400 && selectedYear <= 2400) performCalculations();
  }, [userLocation, selectedYear, selectedMonth]);

  // ==========================================
  // التمرير التلقائي السلس للأسفل عند النقر على الخريطة
  // ==========================================
  useEffect(() => {
    if (userLocation) {
      setTimeout(() => {
        if (resultsRef.current) {
          resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
    }
  }, [userLocation]);

  // ==========================================
  // 4. المحرك الثلاثي الأبعاد
  // ==========================================
  useEffect(() => {
    if (!threeLoaded || !results || !userLocation || !threeCanvasRef.current || !window.THREE) return;

    if (threeSceneRef.current) {
      while(threeCanvasRef.current.firstChild) {
        threeCanvasRef.current.removeChild(threeCanvasRef.current.firstChild);
      }
    }

    const THREE = window.THREE;
    const width = threeCanvasRef.current.clientWidth;
    const height = 450; 

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020205); 
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio); 
    threeCanvasRef.current.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 15;
    controls.maxDistance = 60;

    const createCircleTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 16; canvas.height = 16;
      const context = canvas.getContext('2d');
      context.beginPath(); context.arc(8, 8, 8, 0, Math.PI * 2); context.fillStyle = '#ffffff'; context.fill();
      return new THREE.CanvasTexture(canvas);
    };

    const starsGeo = new THREE.BufferGeometry();
    const starsCount = 300; 
    const posArray = new Float32Array(starsCount * 3);
    for(let i = 0; i < starsCount * 3; i++) posArray[i] = (Math.random() - 0.5) * 150;
    starsGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const starsMat = new THREE.PointsMaterial({
      size: 0.3, color: 0xdddddd, map: createCircleTexture(), transparent: true, opacity: 0.8, alphaTest: 0.5
    });
    scene.add(new THREE.Points(starsGeo, starsMat));

    const get3DPosition = (lat, lng, radius) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lng) * (Math.PI / 180);
      return new THREE.Vector3(radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), -radius * Math.sin(phi) * Math.sin(theta));
    };

    const earthRadius = 10;
    const earthGroup = new THREE.Group();
    scene.add(earthGroup);
    const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 64);
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous'); 
    const textureUrl = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg';
    
    const earthMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 15 });
    textureLoader.load(textureUrl, function(texture) { earthMat.map = texture; earthMat.needsUpdate = true; });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    earth.rotation.set(0, 0, 0); 
    earthGroup.add(earth);

    const date = results.conjunctionTime;
    const timeInHoursUTC = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    const year = date.getUTCFullYear();
    const start = new Date(Date.UTC(year, 0, 0));
    const dayOfYear = Math.floor((date - start) / 86400000);
    const declination = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * (Math.PI / 180));
    const decRad = declination * (Math.PI / 180);
    const eqTime = 9.87 * Math.sin(2 * (360/365)*(dayOfYear-81)*(Math.PI/180)) - 7.53 * Math.cos((360/365)*(dayOfYear-81)*(Math.PI/180)) - 1.5 * Math.sin((360/365)*(dayOfYear-81)*(Math.PI/180));
    
    const sunLng = 180 - ((timeInHoursUTC + eqTime / 60) * 15); 
    const sunPosition3D = get3DPosition(declination, sunLng, 50);

    scene.add(new THREE.AmbientLight(0x1a1a1a)); 
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
    sunLight.position.copy(sunPosition3D);
    scene.add(sunLight);

    const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 32), new THREE.MeshBasicMaterial({ color: 0xffeebb }));
    sunMesh.position.copy(sunPosition3D);
    scene.add(sunMesh);

    const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(0.8, 32, 32), new THREE.MeshPhongMaterial({ color: 0x888888 }));
    moonMesh.position.copy(sunPosition3D).normalize().multiplyScalar(15);
    scene.add(moonMesh);

    const startLinePoints = [];
    for (let lat = 85; lat >= -85; lat -= 1) { 
        const latRad = lat * (Math.PI / 180);
        let cosHourAngle = (Math.sin(-18 * (Math.PI / 180)) - Math.sin(latRad) * Math.sin(decRad)) / (Math.cos(latRad) * Math.cos(decRad));
        if (cosHourAngle > 1 || cosHourAngle < -1) continue; 
        const hourAngle = Math.acos(cosHourAngle) * (180 / Math.PI);
        let lng = sunLng - hourAngle; 
        while(lng > 180) lng -= 360;
        while(lng < -180) lng += 360;
        startLinePoints.push(get3DPosition(lat, lng, earthRadius + 0.05));
    }
    
    if(startLinePoints.length > 0) {
      const startLineCurve = new THREE.CatmullRomCurve3(startLinePoints);
      const startLineGeo = new THREE.TubeGeometry(startLineCurve, 64, 0.05, 8, false);
      const startLineMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      scene.add(new THREE.Mesh(startLineGeo, startLineMat)); 
    }

    const userPos = get3DPosition(userLocation.lat, userLocation.lng, earthRadius + 0.05);
    const userDot = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), new THREE.MeshBasicMaterial({ color: 0x00ff88 }));
    userDot.position.copy(userPos);
    scene.add(userDot);

    const userLatRad = userLocation.lat * (Math.PI / 180);
    let cosHAUser = (Math.sin(-18 * (Math.PI / 180)) - Math.sin(userLatRad) * Math.sin(decRad)) / (Math.cos(userLatRad) * Math.cos(decRad));
    let targetLng = sunLng - 90; 
    
    if (cosHAUser <= 1 && cosHAUser >= -1) {
        const haUser = Math.acos(cosHAUser) * (180 / Math.PI);
        targetLng = sunLng - haUser;
    }
    while(targetLng > 180) targetLng -= 360;
    while(targetLng < -180) targetLng += 360;

    const arcPoints = [];
    let lngDiff = userLocation.lng - targetLng;
    if (lngDiff > 180) lngDiff -= 360;
    if (lngDiff < -180) lngDiff += 360;

    const steps = 60;
    for (let i = 0; i <= steps; i++) {
        const currentLng = targetLng + (lngDiff * (i / steps));
        const basePos = get3DPosition(userLocation.lat, currentLng, earthRadius);
        const fraction = i / steps;
        const archHeight = Math.sin(fraction * Math.PI) * (Math.abs(lngDiff) * 0.012); 
        basePos.normalize().multiplyScalar(earthRadius + 0.05 + archHeight);
        arcPoints.push(basePos);
    }
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arcPoints), 64, 0.06, 8, false), new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.9 })));

    const centerLng = targetLng + (lngDiff / 2);
    const camLat = userLocation.lat > 0 ? Math.min(userLocation.lat + 15, 60) : Math.max(userLocation.lat - 15, -60);
    camera.position.copy(get3DPosition(camLat, centerLng, 32)); 
    controls.target.set(0, 0, 0); 
    controls.update();

    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update(); 
      renderer.render(scene, camera);
    };
    animate();

    threeSceneRef.current = { renderer, animationId };

    return () => {
      cancelAnimationFrame(animationId);
      if (threeCanvasRef.current && renderer.domElement) {
        if (threeCanvasRef.current.contains(renderer.domElement)) {
          threeCanvasRef.current.removeChild(renderer.domElement);
        }
      }
      renderer.dispose();
    };
  }, [results, userLocation, threeLoaded]);
  

  // ==========================================
  // 5. العداد التنازلي
  // ==========================================
  useEffect(() => {
    if (!results) { setCountdown(null); return; }
    const timer = setInterval(() => {
      const now = new Date();
      const diff = results.userFajr.getTime() - now.getTime();
      if (diff <= 0) {
        setCountdown("حل موعد هذا الشهر بهذه المدينة، تقبل الله منكم.");
        clearInterval(timer);
      } else {
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / 1000 / 60) % 60);
        const s = Math.floor((diff / 1000) % 60);
        setCountdown(`${d} يوم و ${h} ساعة و ${m} دقيقة و ${s} ثانية`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [results]);

  const timeOnlyOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };

  const getMonthSpecificUI = () => {
    switch(selectedMonth) {
      case 8: return { title: "موعد بداية الصيام (رمضان)", icon: <Moon className="text-teal-100" size={32}/>, color: "from-teal-600 to-emerald-700" };
      case 9: return { title: "موعد عيد الفطر (نهاية الصيام)", icon: <Star className="text-amber-100" size={32}/>, color: "from-amber-600 to-orange-700" };
      case 11: return { title: "موعد بداية شهر ذي الحجة", icon: <Globe className="text-indigo-100" size={32}/>, color: "from-indigo-600 to-blue-700", hasAdha: true };
      case 0: return { title: "موعد رأس السنة الهجرية (المحرم)", icon: <Calendar className="text-purple-100" size={32}/>, color: "from-purple-600 to-fuchsia-700" };
      default: return { title: "موعد بداية الشهر القمري لمدينتك", icon: <Moon className="text-slate-100" size={32}/>, color: "from-slate-700 to-slate-900" };
    }
  };

  // دالة لتحديد تنسيق الشهر بناءً على الفهرس
  const getMonthStyle = (index) => {
    switch (index) {
      case 0: return { color: '#2563EB', fontWeight: 'bold' }; // المحرم
      case 8: return { color: '#059669', fontWeight: 'bold' }; // رمضان
      case 9: return { color: '#D97706', fontWeight: 'bold' }; // شوال
      case 11: return { color: '#7C3AED', fontWeight: 'bold' }; // ذو الحجة
      default: return { color: '#1E293B', fontWeight: 'normal' }; // باقي الأشهر
    }
  };

  const uiData = getMonthSpecificUI();
  const displayedGregorianYear = getConjunctionTime(selectedYear || BASE_HIJRI_YEAR, selectedMonth).getUTCFullYear();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-12" dir="rtl" style={{ fontFamily: "'Asmaa', 'Cairo', system-ui, -apple-system, sans-serif" }}>
      
      {/* ========================================== */}
      {/* شاشة الفيديو الافتتاحية المدمجة */}
      {/* ========================================== */}
      {showSplash && (
        <div 
          className="fixed inset-0 z-[10000] flex justify-center items-center"
          style={{ 
            opacity: fadeSplash ? 0 : 1, 
            transition: 'opacity 0.8s ease',
            // أضفنا نفس التدرج اللوني لدمج المساحات الفارغة أعلى وأسفل الفيديو
            background: 'linear-gradient(to bottom, #D6E3F0, #F1E6EA)' 
          }}
        >
          <video 
            autoPlay 
            muted 
            playsInline 
            onEnded={handleVideoEnd}
            onError={handleVideoEnd}
            className="w-full h-full object-contain" /* التغيير السحري هنا لاحتواء المشهد بالكامل */
          >
            <source src="intro.mp4" type="video/mp4" />
          </video>
        </div>
      )}

      <header className="bg-indigo-900 text-white p-6 shadow-lg rounded-b-3xl relative overflow-hidden">
        <div className="max-w-5xl mx-auto relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-center md:text-right flex-col md:flex-row">
            <Globe size={48} className="text-yellow-400" />
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">تطبيق يَقِين</h1>
              <p className="text-indigo-200">الميقات الفلكي الموحد لضبط أوائل الشهور والأعياد بدقة متناهية</p>
            </div>
          </div>
          <button onClick={() => setIsAboutOpen(true)} className="flex items-center gap-2 bg-indigo-700 hover:bg-indigo-600 transition px-6 py-3 rounded-full font-bold shadow-md">
            <Info size={20} /> فكرة التطبيق
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 space-y-8 mt-8">
        
        {/* ========================================== */}
        {/* إضافة النص الترحيبي (البيان التأسيسي والآية) */}
        {/* ========================================== */}
        <div className="bg-indigo-50/80 border border-indigo-100 rounded-3xl p-8 shadow-sm flex flex-col items-center gap-6 relative overflow-hidden">
          {/* لمسة تصميمية (علامة اقتباس خلفية) */}
          <Quote className="text-indigo-500/10 absolute top-4 right-4 rotate-180" size={80} />
          
          {/* الآية القرآنية بخط المصحف */}
          <div className="relative z-10 text-center w-full border-b border-indigo-200/60 pb-6">
            <span 
              className="text-3xl md:text-4xl text-emerald-800 leading-relaxed" 
              style={{ fontFamily: "'Amiri Quran', serif", wordSpacing: '2px' }}
            >
              ﴿ فَمَن شَهِدَ مِنكُمُ الشَّهْرَ فَلْيَصُمْهُ ﴾
            </span>
          </div>
          
          {/* النص التعريفي */}
          <div className="relative z-10 text-center max-w-4xl">
            <p className="text-indigo-950 text-lg md:text-xl leading-loose font-medium">
              هذا التطبيق يقضي تماماً على أي إمكانية لأن يتقدم بلد عن بلد آخر بيوم كامل بشكل عشوائي، بل يجعل البشرية كلها تصوم وتفطر بشكل متسلسل يشبه "موجة متتالية" تبدأ من نقطة محددة وتطوف الأرض كلها في 24 ساعة بالضبط.
            </p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="font-bold flex items-center gap-2 text-indigo-900"><Calendar size={20}/> الشهر القمري المطلوب:</label>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="w-full p-3 rounded-xl border-2 border-slate-200 bg-slate-50 font-bold focus:border-indigo-500 outline-none">
              {HIJRI_MONTHS.map((month, index) => (
                <option key={index} value={index} style={getMonthStyle(index)}>{month}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-bold flex items-center gap-2 text-indigo-900"><Hourglass size={20}/> العام الهجري:</label>
            
            {!isManualYear ? (
              <select 
                value={selectedYear} 
                onChange={(e) => {
                  if(e.target.value === 'manual') setIsManualYear(true);
                  else setSelectedYear(parseInt(e.target.value));
                }} 
                className="w-full p-3 rounded-xl border-2 border-slate-200 bg-slate-50 font-bold focus:border-indigo-500 outline-none"
              >
                {availableYears.map(year => {
                  const gregYear = getConjunctionTime(year, selectedMonth).getUTCFullYear();
                  return <option key={year} value={year}>عام {year} هـ ({gregYear} م)</option>;
                })}
                <option value="manual" className="bg-indigo-50 text-indigo-700 font-bold">
                  + إدخال عام آخر يدوياً (حتى 2400 هـ)...
                </option>
              </select>
            ) : (
              <div className="relative flex items-center gap-2 animate-in fade-in zoom-in duration-300">
                <div className="relative flex-1">
                  <input 
                    type="number" 
                    min="1400" 
                    max="2400" 
                    value={selectedYear || ''} 
                    onChange={(e) => {
                      let val = parseInt(e.target.value) || '';
                      if (val > 2400) val = 2400; 
                      setSelectedYear(val);
                    }} 
                    className="w-full p-3 pl-24 rounded-xl border-2 border-indigo-300 bg-white font-bold focus:border-indigo-500 outline-none"
                    placeholder="أدخل العام الهجري..."
                  />
                  {selectedYear >= 1400 && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm pointer-events-none bg-slate-100 px-2 py-1 rounded">
                      يوافق {displayedGregorianYear} م
                    </span>
                  )}
                </div>
                <button 
                  onClick={() => setIsManualYear(false)}
                  className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition"
                  title="العودة للقائمة المنسدلة"
                >
                  <X size={20} />
                </button>
              </div>
            )}
            
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2 relative overflow-hidden">
          <div className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur px-5 py-3 rounded-xl shadow-lg border border-slate-100 font-bold text-indigo-900 pointer-events-none flex items-center gap-2">
            <MapPin size={20} className="text-red-500" />
            انقر على الخريطة لتحديد مدينتك بدقة
          </div>
          <div ref={mapRef} className="w-full h-[400px] rounded-xl z-10" style={{ isolation: 'isolate' }}></div>
        </div>

        {userLocation && (
          <div ref={resultsRef} className="space-y-8 pb-8 mt-8 scroll-mt-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-slate-500 font-bold">جاري معالجة الإحداثيات الفلكية وبناء المجسم...</p>
              </div>
            ) : results ? (
              <>
                <div className="bg-[#020205] rounded-3xl p-1 relative overflow-hidden shadow-2xl border-4 border-slate-800">
                   <div className="absolute top-6 right-6 z-10 bg-black/60 backdrop-blur-md p-4 rounded-xl border border-slate-700 pointer-events-none hidden md:block">
                     <h3 className="text-white font-bold mb-2 flex items-center gap-2"><Globe className="text-blue-400"/> المحاكاة الفلكية 3D</h3>
                     <ul className="text-sm text-slate-300 space-y-2">
                       <li className="flex items-center gap-2"><span className="w-3 h-3 bg-red-600 rounded-full"></span> منحنى الفجر الحقيقي</li>
                       <li className="flex items-center gap-2"><span className="w-3 h-3 bg-green-400 rounded-full"></span> مدينتك المحددة</li>
                       <li className="flex items-center gap-2"><span className="w-3 h-3 bg-amber-500 rounded-full"></span> القوس الزمني للمسار</li>
                     </ul>
                   </div>
                   
                   <div className="absolute top-6 left-6 z-10 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700 pointer-events-none flex items-center gap-2 text-white">
                      <Rotate3D size={18} className="text-teal-400" />
                      <span className="text-sm font-bold">اسحب للتدوير</span>
                   </div>

                   <div ref={threeCanvasRef} className="w-full h-[500px] cursor-grab active:cursor-grabbing rounded-2xl overflow-hidden bg-[#020205]"></div>
                   
                   <div className="text-center p-4 bg-slate-900 text-teal-300 text-sm md:text-base rounded-b-2xl border-t border-slate-800 leading-relaxed">
                     <strong>دلالة المحاكاة:</strong> الخط الأحمر يمثل <strong>"منحنى الفجر الصادق"</strong> (عند زاوية 18 درجة تحت الأفق). ستلاحظ تواجده داخل منطقة الظلام ليسبق شروق الشمس، وهو يُعبّر عن <strong>نقطة الصفر العالمية</strong> التي يبدأ منها الصيام ليطوف الأرض تباعاً مع دورانها.
                   </div>
                </div>

                <div className="bg-[#1e2749] rounded-3xl p-6 text-white shadow-xl">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">الاقتران المركزي (لحظة ولادة {HIJRI_MONTHS[selectedMonth].split(' ')[0]})</h2>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white/10 rounded-2xl p-5 border border-white/5">
                      <div className="text-indigo-200 font-bold mb-3">بالتوقيت العالمي (UTC)</div>
                      <div className="font-bold text-lg mb-1">{getGregorianDateString(results.conjunctionTime)}</div>
                      <div className="text-3xl font-mono font-black text-yellow-400" dir="ltr">{results.conjunctionTime.toLocaleTimeString('en-GB', { timeZone: 'UTC' })}</div>
                    </div>
                    <div className="bg-white/10 rounded-2xl p-5 border border-white/5">
                      <div className="text-indigo-200 font-bold mb-3">التوقيت المحلي لبلدك أو مدينتك</div>
                      <div className="font-bold text-lg mb-1">{getGregorianDateString(results.conjunctionTime)}</div>
                      <div className="text-3xl font-mono font-black text-teal-300" dir="ltr">{results.conjunctionTime.toLocaleTimeString('ar-EG', timeOnlyOptions)}</div>
                    </div>
                  </div>
                </div>

                <div className={`bg-gradient-to-br ${uiData.color} rounded-3xl p-8 text-white shadow-xl text-center relative overflow-hidden`}>
                  <div className="relative z-10">
                    <div className="flex justify-center mb-4">{uiData.icon}</div>
                    <h2 className="text-3xl md:text-4xl font-extrabold mb-3">{uiData.title}</h2>
                    <p className="text-white/80 mb-8 font-medium">بناءً على دوران الأرض ووصول الفجر لمدينتك بعد ولادة الهلال</p>
                    
                    <div className="bg-white text-slate-800 rounded-2xl p-8 mx-auto max-w-2xl shadow-2xl">
                      <div className="text-xl font-bold text-slate-600 mb-4">{getGregorianDateString(results.userFajr)}</div>
                      <div className="text-6xl md:text-7xl font-black font-mono tracking-wider text-slate-900 my-6" dir="ltr">
                        {results.userFajr.toLocaleTimeString('ar-EG', timeOnlyOptions)}
                      </div>
                      
                      <div className="mt-6 pt-6 border-t-2 border-slate-100">
                        <span className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-bold">
                          حالة الدخول: <span className="text-teal-700">{results.status}</span>
                        </span>
                      </div>
                    </div>

                    {uiData.hasAdha && (
                      <div className="mt-8 bg-black/20 p-6 rounded-2xl border border-white/10">
                        <h3 className="text-xl font-bold text-yellow-300 mb-2">موعد عيد الأضحى المبارك (10 ذي الحجة)</h3>
                        <p className="text-lg">
                          يوافق يوم: <strong className="text-white">{getGregorianDateString(new Date(results.userFajr.getTime() + (9 * 86400000)))}</strong>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {countdown && (
                  <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-700 mt-8 mb-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex items-center gap-4">
                        <div className="bg-teal-500/20 p-3 rounded-full"><Hourglass className="text-teal-400 animate-pulse w-8 h-8" /></div>
                        <span className="font-bold text-xl">الوقت المتبقي لمدينتك (حسب الفجر):</span>
                      </div>
                      <div className="bg-slate-800 px-8 py-4 rounded-2xl border-2 border-slate-600 font-mono text-2xl font-black text-yellow-400 text-center w-full md:w-auto shadow-inner" dir="rtl">
                        {countdown}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}
      </main>

      {isAboutOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <button onClick={() => setIsAboutOpen(false)} className="absolute top-6 left-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition"><X size={24} className="text-slate-600" /></button>
            <div className="p-8 md:p-12">
              <div className="flex items-center gap-4 mb-8 border-b pb-6">
                <Globe size={40} className="text-indigo-600" />
                <h2 className="text-3xl font-black text-indigo-900">عن تطبيق يَقِين</h2>
              </div>
              <div className="space-y-6 text-lg text-slate-700 leading-relaxed font-medium">
                <p>في كل عام تتكرر مأساة اختلاف المسلمين في بدايات الشهور والأعياد، وهذا التطبيق هو الحل العلمي والشرعي القطعي لتوحيدها باستخدام حسابات كوكب الأرض.</p>
                <div className="bg-indigo-50 border-r-4 border-indigo-600 p-6 rounded-l-xl">
                  <h3 className="font-bold text-indigo-900 text-xl mb-3">القاعدة الصارمة (نقلة الفجر):</h3>
                  <p>الاقتران المركزي (ميلاد القمر) هو لحظة كونية واحدة لكل الأرض. المنطقة الجغرافية التي يتوافق فجرها تماماً مع لحظة الميلاد تصبح هي "نقطة الصفر".</p>
                </div>
                <p><strong>لماذا الفجر في جميع الشهور؟</strong> لأن المسلم يسأل ليلة الشك (في رمضان أو العيد): "هل أستيقظ غداً صائماً أم مفطراً؟". الفجر هو حد البداية الفعلي لليوم في سياق الصيام. إذا ولد الهلال قبل فجرك، تبدأ شهرك، وإن ولد بعده، تكمل عدتك.</p>
                <p className="font-bold text-emerald-700 bg-emerald-50 p-4 rounded-lg">
                  هذا التطبيق مزود بمحرك فلكي يحسب متوسط الاقتران بدقة، مما يتيح لك معرفة أوائل الشهور والأعياد بضغطة زر لقرون قادمة.
                </p>
              </div>
              <div className="mt-12 pt-6 border-t text-center">
                <p className="text-slate-500 mb-2">إعداد وتصميم التطبيق</p>
                <p className="text-2xl font-bold text-indigo-900 font-serif">أحمد طلعت</p>
                <a href="mailto:ahmadalazab2022@gmail.com" className="text-indigo-600 hover:underline font-mono mt-1 block">ahmadalazab2022@gmail.com</a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}