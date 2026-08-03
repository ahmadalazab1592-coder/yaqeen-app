import React, { useState, useEffect, useRef } from 'react';
import { Moon, MapPin, Globe, Info, Calendar, X, Hourglass, Rotate3D, Star, Quote, BookOpen, Download, Eye } from 'lucide-react';
import html2canvas from 'html2canvas';

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

const sinDeg = (deg) => Math.sin(deg * Math.PI / 180.0);

const getTrueConjunction = (approximateDateMs) => {
    let jdApprox = (approximateDateMs / 86400000.0) + 2440587.5;
    let k = Math.round((jdApprox - 2451550.09766) / 29.530588861);
    
    let T = k / 1236.85;
    let T2 = T * T;
    let T3 = T2 * T;
    let T4 = T3 * T;
    
    let jdMean = 2451550.09766 + 29.530588861 * k 
                + 0.0001337 * T2 - 0.000000150 * T3 + 0.00000000073 * T4;
    
    let M = 2.5534 + 29.10535670 * k - 0.0000218 * T2 - 0.00000011 * T3;
    let Mprime = 201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3;
    let F = 160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3;
    let OM = 124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3;
    let E = 1 - 0.002516 * T - 0.0000074 * T2;
    
    let correction = 
        -0.40720 * sinDeg(Mprime) + 0.17241 * E * sinDeg(M) + 0.01608 * sinDeg(2 * Mprime) 
        + 0.01039 * sinDeg(2 * F) + 0.00739 * E * sinDeg(Mprime - M) - 0.00514 * E * sinDeg(Mprime + M) 
        + 0.00208 * E * E * sinDeg(2 * M) - 0.00111 * sinDeg(Mprime - 2 * F) - 0.00057 * sinDeg(Mprime + 2 * F) 
        + 0.00056 * E * sinDeg(2 * Mprime + M) - 0.00042 * sinDeg(3 * Mprime) + 0.00042 * E * sinDeg(M + 2 * F) 
        + 0.00038 * E * sinDeg(M - 2 * F) - 0.00024 * E * sinDeg(2 * Mprime - M) - 0.00017 * sinDeg(OM) 
        - 0.00007 * sinDeg(Mprime + 2 * M) + 0.00004 * sinDeg(2 * Mprime - 2 * F) + 0.00004 * sinDeg(3 * M) 
        + 0.00003 * sinDeg(Mprime + M - 2 * F) + 0.00003 * sinDeg(2 * Mprime + 2 * F) - 0.00003 * sinDeg(Mprime + M + 2 * F) 
        + 0.00003 * sinDeg(Mprime - M + 2 * F) - 0.00002 * sinDeg(Mprime - M - 2 * F) - 0.00002 * sinDeg(3 * Mprime + M) 
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

const getGregorianDateString = (date, tz) => {
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: tz
    }).format(date);
  } catch (e) {
    return new Intl.DateTimeFormat('ar-EG', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    }).format(date);
  }
};

const formatTime = (date, tz) => {
  try {
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: tz });
  } catch (e) {
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  }
};

export default function YaqeenApp() {
  const [selectedYear, setSelectedYear] = useState(BASE_HIJRI_YEAR);
  const [selectedMonth, setSelectedMonth] = useState(8); 
  const [isManualYear, setIsManualYear] = useState(false); 
  const [userLocation, setUserLocation] = useState(null);
  const [locationName, setLocationName] = useState(""); 
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [threeLoaded, setThreeLoaded] = useState(false);
  const [exportTimestamp, setExportTimestamp] = useState(""); 
  
  const [showSplash, setShowSplash] = useState(true);
  const [fadeSplash, setFadeSplash] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerInstance = useRef(null);
  const threeCanvasRef = useRef(null);
  const threeSceneRef = useRef(null);
  const resultsRef = useRef(null);
  const exportCardRef = useRef(null); 
  const availableYears = generateYears();

  const handleVideoEnd = () => {
    setFadeSplash(true);
    setTimeout(() => setShowSplash(false), 800); 
  };

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
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Amiri&family=Cairo:wght@400;700;900&display=swap';
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

    mapInstance.current.on('click', async (e) => {
      const { lat, lng } = e.latlng;
      let tzString = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setUserLocation({ lat, lng, timeZone: tzString });
      setLocationName("جاري التحديد...");
      
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

      try {
        const [geoRes, tzRes] = await Promise.all([
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1&accept-language=ar`).catch(()=>null),
            fetch(`https://api.wheretheiss.at/v1/coordinates/${lat},${lng}`).catch(()=>null)
        ]);

        if (geoRes && geoRes.ok) {
            const data = await geoRes.json();
            const address = data.address || {};
            const city = address.city || address.town || address.village || address.state || address.county || "";
            const country = address.country || "";
            const fullName = city ? `${city}، ${country}` : country || `إحداثيات: ${lat.toFixed(2)}, ${lng.toFixed(2)}`;
            setLocationName(fullName);
        } else {
            setLocationName(`إحداثيات: ${lat.toFixed(2)}, ${lng.toFixed(2)}`);
        }

        let tzSuccess = false;
        if (tzRes && tzRes.ok) {
            const tzData = await tzRes.json();
            if (tzData && tzData.timezone_id) {
                tzString = tzData.timezone_id;
                tzSuccess = true;
            }
        }
        
        if (!tzSuccess) {
            const timeApiRes = await fetch(`https://timeapi.io/api/TimeZone/coordinate?latitude=${lat}&longitude=${lng}`).catch(()=>null);
            if (timeApiRes && timeApiRes.ok) {
                const timeApiData = await timeApiRes.json();
                if (timeApiData && timeApiData.timeZone) {
                    tzString = timeApiData.timeZone;
                }
            }
        }
        
        setUserLocation({ lat, lng, timeZone: tzString });
      } catch (err) {
        setLocationName(`إحداثيات: ${lat.toFixed(2)}, ${lng.toFixed(2)}`);
      }
    });
  }

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

  useEffect(() => {
    if (userLocation && resultsRef.current) {
      setTimeout(() => resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
  }, [userLocation]);

  const exportAsImage = async () => {
    if (!exportCardRef.current) return;
    setExportTimestamp(new Date().toLocaleString('ar-EG'));
    
    setTimeout(async () => {
      try {
        const canvas = await html2canvas(exportCardRef.current, {
          scale: 2, 
          useCORS: true, 
          backgroundColor: '#0f172a' 
        });
        const image = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.href = image;
        link.download = `Yaqeen_Result_${HIJRI_MONTHS[selectedMonth].split(' ')[0]}_${selectedYear}.png`;
        link.click();
      } catch (error) {
        console.error("حدث خطأ أثناء تصدير الصورة: ", error);
      }
    }, 200);
  };

  const handleOpenPreview = () => {
    setExportTimestamp(new Date().toLocaleString('ar-EG'));
    setShowPreview(true);
  };

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
    
    while (lngDiff > 0) {
        lngDiff -= 360;
    }
    while (lngDiff <= -360) {
        lngDiff += 360;
    }

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
      case 8: return { title: "موعد بداية الصيام (رمضان)" };
      case 9: return { title: "موعد عيد الفطر المبارك (شوال)" };
      case 11: return { title: "موعد بداية شهر ذي الحجة" };
      case 0: return { title: "موعد رأس السنة الهجرية (المحرم)" };
      default: return { title: "موعد بداية الشهر القمري لمدينتك" };
    }
  };

  const getSpecialNote = (monthIndex) => {
    switch(monthIndex) {
      case 8: return "بناءً على الحساب الفلكي القطعي لنقلة الفجر، يبدأ الصيام الشرعي مع فجر هذا اليوم بمدينتك المحددة، تقبل الله طاعتكم.";
      case 9: return "بناءً على الحساب الفلكي القطعي، يحل عيد الفطر المبارك ويفطر المسلمون في هذا اليوم بمدينتك، كل عام وأنتم بخير.";
      case 11: return "بناءً على الحساب الفلكي القطعي، يبدأ شهر ذي الحجة في هذا اليوم، ويحل عيد الأضحى المبارك في اليوم العاشر منه.";
      case 0: return "بناءً على الحساب الفلكي القطعي، هذا هو فجر أول أيام العام الهجري الجديد، جعله الله عام خير وبركة.";
      default: return "بناءً على الحساب الفلكي القطعي، هذا هو فجر أول أيام الشهر القمري لمدينتك المحددة.";
    }
  };

  const getMonthStyle = (index) => {
    switch (index) {
      case 0: return { color: '#2563EB', fontWeight: 'bold' }; 
      case 8: return { color: '#059669', fontWeight: 'bold' }; 
      case 9: return { color: '#D97706', fontWeight: 'bold' }; 
      case 11: return { color: '#7C3AED', fontWeight: 'bold' }; 
      default: return { color: '#1E293B', fontWeight: 'normal' }; 
    }
  };

  const uiData = getMonthSpecificUI();
  const displayedGregorianYear = getConjunctionTime(selectedYear || BASE_HIJRI_YEAR, selectedMonth).getUTCFullYear();
  const monthNameWithoutParentheses = HIJRI_MONTHS[selectedMonth].split(' ')[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-12" dir="rtl" style={{ fontFamily: "'Asmaa', 'Cairo', system-ui, -apple-system, sans-serif" }}>
      
      {showSplash && (
        <div 
          className="fixed inset-0 z-[10000] flex justify-center items-center"
          style={{ 
            opacity: fadeSplash ? 0 : 1, 
            transition: 'opacity 0.8s ease',
            background: 'linear-gradient(to bottom, #D6E3F0, #F1E6EA)' 
          }}
        >
          <video 
            autoPlay 
            muted 
            playsInline 
            onEnded={handleVideoEnd}
            onError={handleVideoEnd}
            className="w-full h-full object-contain" 
          >
            <source src="intro.mp4" type="video/mp4" />
          </video>
          <button 
            onClick={handleVideoEnd}
            className="absolute bottom-10 left-10 bg-white/40 hover:bg-white/60 backdrop-blur-md text-slate-800 px-6 py-2 rounded-full font-bold border border-white/50 shadow-lg transition-all duration-300 flex items-center gap-2 z-50"
          >
            تخطي
            <span className="text-xl leading-none -mt-1">&raquo;</span>
          </button>
        </div>
      )}

      {/* ========================================== */}
      {/* نافذة معاينة وتصدير النتيجة (البطاقة الفاخرة) */}
      {/* ========================================== */}
      {showPreview && results && (
        <div className="fixed inset-0 z-[99999] bg-slate-900/95 backdrop-blur-sm overflow-y-auto">
          
          <div className="min-h-screen flex flex-col items-center py-10 px-4">
            
            <div className="flex gap-4 mb-6 z-10 relative">
              <button 
                onClick={exportAsImage} 
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-full font-bold flex gap-2 items-center shadow-lg transition-all"
              >
                <Download size={20} /> تحميل الصورة الموثقة
              </button>
              <button 
                onClick={() => setShowPreview(false)} 
                className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-full font-bold flex gap-2 items-center shadow-lg transition-all"
              >
                <X size={20} /> إغلاق المعاينة
              </button>
            </div>

            <div className="w-full overflow-x-auto flex justify-center pb-8">
              
              <div 
                ref={exportCardRef} 
                className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-[2.5rem] p-10 shadow-2xl relative border-4 border-indigo-500/30" 
                style={{ width: '850px', minWidth: '850px', maxWidth: 'none', fontFamily: "'Asmaa', 'Cairo', sans-serif" }} 
                dir="rtl"
              >
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/20 rounded-full pointer-events-none"></div>

                <div className="text-center pb-6 border-b border-white/10 mb-8 relative z-10">
                  <Globe className="text-yellow-400 mx-auto mb-4 drop-shadow-md" size={60} />
                  <h1 className="text-4xl font-black text-yellow-400 mb-2 drop-shadow-md">
                    تطبيق يَقِين للميقات الفلكي
                  </h1>
                  <p className="text-indigo-200 text-lg font-bold">التوثيق الفلكي لضبط أوائل الشهور القمرية والأعياد</p>
                </div>

                <div className="relative z-10 space-y-6">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-6 text-center shadow-lg">
                        <h2 className="text-2xl font-bold text-white mb-2">{uiData.title}</h2>
                        <p className="text-yellow-400 font-bold text-lg">لعام {selectedYear} هـ / يوافق {displayedGregorianYear} م</p>
                      </div>
                      <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-6 text-center shadow-lg">
                         <div className="text-indigo-200 font-bold mb-2 text-sm">المنطقة الجغرافية المحددة</div>
                         <div className="font-bold text-2xl flex justify-center items-center gap-2 text-white">
                           <MapPin className="text-emerald-400" size={24}/> {locationName}
                         </div>
                      </div>
                    </div>

                    <div className="bg-[#1e2749] rounded-3xl p-6 text-white shadow-lg border border-indigo-500/20">
                      <div className="text-center mb-5">
                        <h2 className="text-xl font-bold text-white mb-1">الاقتران المركزي (لحظة ولادة {monthNameWithoutParentheses})</h2>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#0f172a] rounded-2xl p-4 border border-white/5 text-center">
                          <div className="text-indigo-200 font-bold mb-2 text-sm">التوقيت المحلي لبلدك أو مدينتك</div>
                          <div className="font-bold text-base mb-1">{getGregorianDateString(results.conjunctionTime, userLocation?.timeZone)}</div>
                          <div className="text-2xl font-mono font-black text-teal-300" dir="ltr">{formatTime(results.conjunctionTime, userLocation?.timeZone)}</div>
                        </div>
                        <div className="bg-[#0f172a] rounded-2xl p-4 border border-white/5 text-center">
                          <div className="text-indigo-200 font-bold mb-2 text-sm">بالتوقيت العالمي (UTC)</div>
                          <div className="font-bold text-base mb-1">{getGregorianDateString(results.conjunctionTime, 'UTC')}</div>
                          <div className="text-2xl font-mono font-black text-yellow-400" dir="ltr">{results.conjunctionTime.toLocaleTimeString('en-GB', { timeZone: 'UTC' })}</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#0d9488] rounded-3xl p-8 text-white shadow-xl text-center relative overflow-hidden border border-emerald-400/30">
                      <div className="flex justify-center mb-2"><Moon className="text-teal-100" size={32}/></div>
                      <h2 className="text-3xl font-bold mb-2">{uiData.title}</h2>
                      <p className="text-emerald-100 mb-6 font-medium text-sm">بناءً على دوران الأرض ووصول الفجر لمدينتك بعد ولادة الهلال</p>
                      
                      <div className="bg-white/95 backdrop-blur-sm text-slate-800 rounded-2xl p-6 mx-auto max-w-xl shadow-2xl">
                        <div className="text-lg font-bold text-slate-600 mb-4">{getGregorianDateString(results.userFajr, userLocation?.timeZone)}</div>
                        <div className="text-5xl font-black font-mono text-slate-900 my-4" dir="ltr">
                          {formatTime(results.userFajr, userLocation?.timeZone)}
                        </div>
                        <div className="mt-4 pt-4 border-t-2 border-slate-200">
                          <span className="text-slate-600 font-bold text-sm bg-slate-100 px-4 py-1 rounded-full border border-slate-200">
                            حالة الدخول: {results.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {countdown && (
                      <div className="bg-[#0f172a] text-white p-5 rounded-2xl shadow-lg border border-slate-700 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center justify-start gap-3 w-full md:w-auto">
                          <div className="bg-teal-900/50 p-2 rounded-full border border-teal-500/30">
                            <Hourglass className="text-teal-400 w-6 h-6" />
                          </div>
                          <span className="font-bold text-lg text-slate-200">الوقت المتبقي لمدينتك (حسب الفجر):</span>
                        </div>
                        
                        <div className="bg-[#1e293b] px-6 py-3 rounded-xl border border-[#334155] w-full md:w-auto text-center flex-1 md:flex-none min-w-[350px]">
                          <span className="font-mono text-xl font-bold text-yellow-400" dir="rtl">{countdown}</span>
                        </div>
                      </div>
                    )}
                </div>

                <div className="text-center text-slate-400 text-sm mt-8 font-bold pt-6 border-t border-white/10 flex justify-between items-center px-4 relative z-10">
                   <span>تم استخراج هذه النتيجة من منصة "يَقِين"</span>
                   <span dir="ltr">{exportTimestamp || new Date().toLocaleString('ar-EG')} :تاريخ التوثيق</span>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* واجهة التطبيق الرئيسية */}
      {/* ========================================== */}
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
        <div className="bg-indigo-50/80 border border-indigo-100 rounded-3xl p-8 shadow-sm flex flex-col items-center gap-6 relative overflow-hidden">
          <Quote className="text-indigo-500/10 absolute top-4 right-4 rotate-180" size={80} />
          <div className="relative z-10 text-center w-full border-b border-indigo-200/60 pb-6">
            <span className="text-3xl md:text-4xl text-emerald-800 leading-relaxed font-bold" style={{ fontFamily: "'Amiri', 'Amiri Quran', serif", wordSpacing: '2px' }}>
              ﴿ فَمَن شَهِدَ مِنكُمُ الشَّهْرَ فَلْيَصُمْهُ ﴾
            </span>
          </div>
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
                    type="number" min="1400" max="2400" value={selectedYear || ''} 
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
                <button onClick={() => setIsManualYear(false)} className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition">
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
          <div ref={resultsRef} className="space-y-6 pb-8 mt-8 scroll-mt-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-slate-500 font-bold">جاري معالجة الإحداثيات الفلكية وبناء المجسم...</p>
              </div>
            ) : results ? (
              <>
                <div className="flex justify-center mb-4">
                  <button 
                    onClick={handleOpenPreview}
                    className="bg-[#00c853] hover:bg-[#00e676] text-white px-8 py-3 rounded-full font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 text-lg transform hover:-translate-y-1"
                  >
                    <Eye size={22} />
                    معاينة وتوثيق النتيجة كبطاقة
                  </button>
                </div>

                <div className="bg-[#020205] rounded-3xl p-1 relative overflow-hidden shadow-xl">
                   
                   {/* العلامات التوضيحية للألوان (التي تمت إضافتها) */}
                   <div className="absolute top-6 right-6 z-10 bg-black/60 backdrop-blur-md p-4 rounded-xl border border-slate-700 pointer-events-none hidden md:block text-right">
                     <h3 className="text-white font-bold mb-3 flex items-center gap-2 justify-start">
                       <Globe className="text-blue-400" size={18} /> 
                       المحاكاة الفلكية 3D
                     </h3>
                     <ul className="text-sm text-slate-300 space-y-3">
                       <li className="flex items-center gap-3">
                         <span className="w-3 h-3 bg-[#ff0000] rounded-full shadow-[0_0_8px_#ff0000]"></span> 
                         <span>منحنى الفجر الحقيقي</span>
                       </li>
                       <li className="flex items-center gap-3">
                         <span className="w-3 h-3 bg-[#00ff88] rounded-full shadow-[0_0_8px_#00ff88]"></span> 
                         <span>مدينتك المحددة</span>
                       </li>
                       <li className="flex items-center gap-3">
                         <span className="w-3 h-3 bg-[#ffaa00] rounded-full shadow-[0_0_8px_#ffaa00]"></span> 
                         <span>القوس الزمني للمسار</span>
                       </li>
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

                <div className="bg-[#1e2749] rounded-3xl p-6 text-white shadow-md mt-6">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">الاقتران المركزي (لحظة ولادة {monthNameWithoutParentheses})</h2>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white/10 rounded-2xl p-5 border border-white/5 text-center">
                      <div className="text-indigo-200 font-bold mb-3">التوقيت المحلي لبلدك أو مدينتك</div>
                      <div className="font-bold text-lg mb-1">{getGregorianDateString(results.conjunctionTime, userLocation?.timeZone)}</div>
                      <div className="text-3xl font-mono font-black text-teal-300" dir="ltr">{formatTime(results.conjunctionTime, userLocation?.timeZone)}</div>
                    </div>
                    <div className="bg-white/10 rounded-2xl p-5 border border-white/5 text-center">
                      <div className="text-indigo-200 font-bold mb-3">بالتوقيت العالمي (UTC)</div>
                      <div className="font-bold text-lg mb-1">{getGregorianDateString(results.conjunctionTime, 'UTC')}</div>
                      <div className="text-3xl font-mono font-black text-yellow-400" dir="ltr">{results.conjunctionTime.toLocaleTimeString('en-GB', { timeZone: 'UTC' })}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0d9488] rounded-3xl p-8 text-white shadow-md text-center mt-6">
                  <div className="flex justify-center mb-2"><Moon className="text-teal-100" size={32}/></div>
                  <h2 className="text-3xl font-bold mb-2">{uiData.title}</h2>
                  <p className="text-white/80 mb-6 font-medium text-sm">بناءً على دوران الأرض ووصول الفجر لمدينتك بعد ولادة الهلال</p>
                  
                  <div className="bg-slate-50 text-slate-800 rounded-2xl p-6 mx-auto max-w-2xl shadow-lg">
                    <div className="text-lg font-bold text-slate-600 mb-4">{getGregorianDateString(results.userFajr, userLocation?.timeZone)}</div>
                    <div className="text-6xl font-black font-mono text-slate-900 my-4" dir="ltr">
                      {formatTime(results.userFajr, userLocation?.timeZone)}
                    </div>
                    <div className="mt-4 pt-4 border-t-2 border-slate-200">
                      <span className="text-slate-500 font-bold text-sm">
                        حالة الدخول: {results.status}
                      </span>
                    </div>
                  </div>
                </div>

                {countdown && (
                  <div className="bg-[#0f172a] text-white p-5 rounded-3xl shadow-md border border-[#1e293b] mt-6 mb-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex items-center justify-start gap-3 w-full md:w-auto">
                        <div className="bg-teal-900/50 p-2 rounded-full border border-teal-500/30">
                          <Hourglass className="text-teal-400 w-6 h-6" />
                        </div>
                        <span className="font-bold text-lg text-slate-200">الوقت المتبقي لمدينتك (حسب الفجر):</span>
                      </div>
                      
                      <div className="bg-[#1e293b] px-6 py-3 rounded-xl border border-[#334155] w-full md:w-auto text-center flex-1 md:flex-none min-w-[350px]">
                        <span className="font-mono text-xl font-bold text-yellow-400" dir="rtl">{countdown}</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}
      </main>

      {/* ========================================== */}
      {/* نافذة "عن التطبيق" (المقال الشامل) */}
      {/* ========================================== */}
      {isAboutOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-6">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative" style={{ scrollBehavior: 'smooth' }}>
            <button onClick={() => setIsAboutOpen(false)} className="absolute top-6 left-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition z-20">
              <X size={24} className="text-slate-600" />
            </button>
            <div className="p-8 md:p-12">
              <div className="flex items-center gap-4 mb-8 border-b pb-6">
                <Globe size={40} className="text-indigo-600" />
                <h2 className="text-3xl font-black text-indigo-900">عن تطبيق يَقِين</h2>
              </div>
              <div className="space-y-6 text-lg text-slate-700 leading-relaxed font-medium mb-10">
                <p>في كل عام تتكرر مأساة اختلاف المسلمين في بدايات الشهور والأعياد، وهذا التطبيق هو الحل العلمي والشرعي القطعي لتوحيدها باستخدام حسابات كوكب الأرض.</p>
                <div className="bg-indigo-50 border-r-4 border-indigo-600 p-6 rounded-l-xl">
                  <h3 className="font-bold text-indigo-900 text-xl mb-3">القاعدة الصارمة (نقلة الفجر):</h3>
                  <p>الاقتران المركزي (ميلاد القمر) هو لحظة كونية واحدة لكل الأرض. المنطقة الجغرافية التي يتوافق فجرها تماماً مع لحظة الميلاد تصبح هي "نقطة الصفر" العالمية.</p>
                </div>
                <p>
                  <strong className="text-indigo-900">لماذا الفجر في جميع الشهور؟</strong> لأن المسلم يسأل ليلة الشك (في رمضان أو العيد): "هل أستيقظ غداً صائماً أم مفطراً؟". الفجر هو حد البداية الفعلي لليوم في سياق الصيام. إذا ولد الهلال قبل فجرك، تبدأ شهرك، وإن ولد بعده، تكمل عدتك.
                </p>
                <p className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-100 p-5 rounded-xl shadow-sm">
                  هذا التطبيق مزود بمحرك فلكي يحسب لحظة الاقتران بدقة متناهية تتفق مع أكبر المواقع العلمية المتخصصة تماماً، مما يتيح لك معرفة أوائل الشهور والأعياد بضغطة زر لقرون قادمة.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 md:p-10 shadow-inner">
                <div className="text-center mb-10">
                  <h3 className="text-3xl md:text-4xl text-emerald-800 leading-relaxed font-bold mb-4" style={{ fontFamily: "'Amiri', 'Amiri Quran', serif" }}>
                    ﴿ فَمَن شَهِدَ مِنكُمُ الشَّهْرَ فَلْيَصُمْهُ ﴾
                  </h3>
                  <p className="text-xl text-indigo-900 font-bold">دراسة في الصياغة القرآنية وتوحيد صيام المسلمين</p>
                </div>
                <div className="space-y-8 text-slate-700 leading-loose text-lg font-medium">
                  <p>في هذا المقال، سنغوص في دلالات ومعاني الحروف والكلمات في قوله تعالى: <span className="text-emerald-700 font-bold">﴿ فَمَن شَهِدَ مِنكُمُ الشَّهْرَ فَلْيَصُمْهُ ﴾</span>، من خلال تدبر الصياغة القرآنية الدقيقة. هدفنا هو محاولة الإجابة على سؤال طالما شغل بال الكثيرين: هل يمكن توحيد المسلمين في بدء شهر الصيام؟</p>
                  <div className="bg-white p-6 md:p-8 rounded-2xl border-r-4 border-emerald-500 shadow-sm text-center my-8">
                    <p className="text-emerald-800 text-xl md:text-2xl leading-loose font-bold" style={{ fontFamily: "'Amiri', 'Amiri Quran', serif" }}>
                      ﴿ شَهْرُ رَمَضَانَ الَّذِي أُنزِلَ فِيهِ الْقُرْآنُ هُدًى لِّلنَّاسِ وَبَيِّنَاتٍ مِّنَ الْهُدَىٰ وَالْفُرْقَانِ ۚ فَمَن شَهِدَ مِنكُمُ الشَّهْرَ فَلْيَصُمْهُ ۖ وَمَن كَانَ مَرِيضًا أَوْ عَلَىٰ سَفَرٍ فَعِدَّةٌ مِّنْ أَيَّامٍ أُخَرَ ۗ يُرِيدُ اللَّهُ بِكُمُ الْيُسْرَ وَلَا يُرِيدُ بِكُمُ الْعُسْرَ وَلِتُكْمِلُوا الْعِدَّةَ وَلِتُكَبِّرُوا اللَّهَ عَلَىٰ مَا هَدَاكُمْ وَلَعَلَّكُمْ تَشْكُرُونَ ﴾
                    </p>
                  </div>
                  <div className="mt-12">
                    <h4 className="text-2xl font-bold text-indigo-900 border-b-2 border-indigo-100 pb-2 mb-6 flex items-center gap-3">
                      <span className="w-3 h-3 bg-indigo-500 rounded-full inline-block rotate-45"></span> ملاحظات حول الصياغة اللغوية
                    </h4>
                    <ul className="space-y-6 list-none pr-4 border-r-2 border-indigo-100">
                      <li className="relative before:absolute before:right-[-1.45rem] before:top-3 before:w-3 before:h-3 before:bg-indigo-400 before:rounded-full">
                        <strong className="text-indigo-800 text-xl block mb-1">خطاب حالة لا خطاب جماعة أو فرد:</strong> 
                        الخطاب ليس خطابًا جماعيًا للأمة جمعاء، ولا هو خطاب فردي لشخص بعينه، بل هو "خطاب حالة". تتجلى في استخدام <span className="text-emerald-700 font-bold">"مَن"</span> و<span className="text-emerald-700 font-bold">"مِنكُمُ"</span>، بدلاً من "إذا شهدتم" أو "الذي يشهد".
                      </li>
                      <li className="relative before:absolute before:right-[-1.45rem] before:top-3 before:w-3 before:h-3 before:bg-indigo-400 before:rounded-full">
                        <strong className="text-indigo-800 text-xl block mb-1">دلالة التنكير في "مَن":</strong> 
                        تفيد تعميم الحالة. "مَن" تعني أن كل من سيشهد الشهر من المسلمين وجب عليه الصيام فورًا، وهذا يختلف عن الخطاب الفردي الذي يترتب عليه أحكام جزئية.
                      </li>
                      <li className="relative before:absolute before:right-[-1.45rem] before:top-3 before:w-3 before:h-3 before:bg-indigo-400 before:rounded-full">
                        <strong className="text-indigo-800 text-xl block mb-1">الفورية في الوجوب:</strong> 
                        الفاء في <span className="text-emerald-700 font-bold">"فَلْيَصُمْهُ"</span> للترتيب المبني على ما قبله؛ فشهادة الشهر يترتب عليها وجوب الصيام الفوري، واللام تؤكد هذا الوجوب القطعي.
                      </li>
                      <li className="relative before:absolute before:right-[-1.45rem] before:top-3 before:w-3 before:h-3 before:bg-indigo-400 before:rounded-full">
                        <strong className="text-indigo-800 text-xl block mb-1">الماضي في "شَهِدَ" ومعرفة البداية:</strong> 
                        جاء الفعل بصيغة الماضي ليدل على أن شهادة الشهر (أي معرفة بدايته الواحدة) مسألة قد تمت وعُلمت وتسبق الصيام. ولو جاءت بصيغة المضارع لدلّت على تعدد شهادات الأيام.
                      </li>
                      <li className="relative before:absolute before:right-[-1.45rem] before:top-3 before:w-3 before:h-3 before:bg-indigo-400 before:rounded-full">
                        <strong className="text-indigo-800 text-xl block mb-1">التمييز المكاني في "مِنكُمُ":</strong> 
                        تشير إلى أن هناك من شهد الشهر وهناك من لم يشهده وقت البداية، وهذا يقودنا إلى فهم عميق لدلالة كلمة الشهادة.
                      </li>
                    </ul>
                  </div>
                  <div className="mt-12">
                    <h4 className="text-2xl font-bold text-indigo-900 border-b-2 border-indigo-100 pb-2 mb-6 flex items-center gap-3">
                      <span className="w-3 h-3 bg-teal-500 rounded-full inline-block rotate-45"></span> دلالات جذر "شهد" في القرآن
                    </h4>
                    <p className="mb-6">الجذر "شهد" يعني الإقرار والتأكيد على مسألة بناءً على الإيمان، أو العلم، أو المعايشة (الحضور الزماني والمكاني للحدث). ويتضح الفارق الكبير بين مشتقاته في القرآن كالتالي:</p>
                    <div className="grid md:grid-cols-2 gap-6 mb-6">
                      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-md">
                        <div className="flex items-center gap-2 mb-3">
                           <span className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold">1</span>
                           <h5 className="font-black text-teal-800 text-xl">الشَّاهِد</h5>
                        </div>
                        <p className="text-base leading-relaxed text-slate-600">يُقر ويؤكد مسألة يعتقدها بناءً على علمه أو نظره، دون أن يشهدها زمانًا ومكانًا. مثل: <span className="text-emerald-700 font-bold">﴿ وَشَهِدَ شَاهِدٌ مِّنْ أَهْلِهَا ﴾</span> فهو لم يرَ الواقعة بعينه، بل حكم بالاستنتاج والعلم والفراسة.</p>
                      </div>
                      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-md">
                        <div className="flex items-center gap-2 mb-3">
                           <span className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold">2</span>
                           <h5 className="font-black text-teal-800 text-xl">الشَّهِيد</h5>
                        </div>
                        <p className="text-base leading-relaxed text-slate-600">وهو الذي حضر الحدث وعايشه زمانًا ومكانًا بنفسه. كقوله تعالى: <span className="text-emerald-700 font-bold">﴿ وَاسْتَشْهِدُوا شَهِيدَيْنِ مِن رِّجَالِكُمْ ﴾</span>.</p>
                      </div>
                    </div>
                    <div className="bg-teal-50 border-r-4 border-teal-500 text-teal-900 p-6 rounded-l-2xl">
                      <p className="text-lg">من إعجاز القرآن أن كلمة <span className="text-emerald-700 font-bold">"شَهِدَ"</span> في آية الصيام استوعبت كلا المعنيين معاً: <strong>عاش وحضر</strong> (الحضور الزماني والمكاني)، وكان <strong>صحيحاً عاقلاً يمتلك المعرفة العلمية اليقينية</strong> بحلول الشهر.</p>
                    </div>
                  </div>
                  <div className="mt-12">
                    <h4 className="text-2xl font-bold text-indigo-900 border-b-2 border-indigo-100 pb-2 mb-6 flex items-center gap-3">
                      <span className="w-3 h-3 bg-amber-500 rounded-full inline-block rotate-45"></span> الحضور الزماني والمكاني وتوحيد الصيام
                    </h4>
                    <ul className="space-y-6 list-none pr-4 border-r-2 border-amber-200">
                      <li className="relative before:absolute before:right-[-1.45rem] before:top-3 before:w-3 before:h-3 before:bg-amber-400 before:rounded-full">
                        <strong className="text-indigo-800 text-xl block mb-1">الحضور الزماني (بداية الشهر):</strong> 
                        ميلاد الهلال (الاقتران) هو مسألة كونية تحدث لكل الأرض في نفس اللحظة وثانية واحدة.
                      </li>
                      <li className="relative before:absolute before:right-[-1.45rem] before:top-3 before:w-3 before:h-3 before:bg-amber-400 before:rounded-full">
                        <strong className="text-indigo-800 text-xl block mb-1">الحضور المكاني (مِنكُمُ):</strong> 
                        لو كان الشرط زمانياً فقط، لوجب الصيام على كل الكوكب فور ولادة الهلال ولو كانوا في منتصف الليل! ولكن بسبب كروية الأرض يختلف الحضور المكاني لـ "الفجر"؛ لذا جاء الخطاب لجزء من الأمة (من سيصوم أولاً، ثم من يليه).
                      </li>
                      <li className="relative before:absolute before:right-[-1.45rem] before:top-3 before:w-3 before:h-3 before:bg-amber-400 before:rounded-full">
                        <strong className="text-indigo-800 text-xl block mb-1">تقديم "مِنكُمُ" على "الشَّهْرَ":</strong> 
                        هذا التقديم البلاغي يؤكد أن وجوب الصيام ارتبط بشرطين لا ينفصلان: الشرط المكاني الخاص (منكم) والشرط الزماني العام (الشهر).
                      </li>
                    </ul>
                  </div>
                  <div className="bg-indigo-900 text-white p-8 rounded-3xl shadow-2xl mt-12 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-bl-full"></div>
                    <h4 className="text-2xl font-bold text-yellow-400 mb-4 relative z-10">نحو تصور عملي لتوحيد صيام المسلمين</h4>
                    <p className="leading-loose text-lg text-indigo-50 relative z-10">
                      بناءً على ما سبق، يقدم هذا التطبيق نظاماً يجمع المسلمين على صيام واحد منضبط: بمجرد ولادة الهلال، ستكون هناك <strong>بقعة واحدة فقط</strong> على الأرض يوافق فيها "وقت الفجر المحلي" لحظة "ولادة الهلال". هذا المكان هو نقطة الصفر وأول من يبدأ الصيام لتطابق الزمان والمكان فيه. أما باقي بلدان العالم، فعليها الانتظار حتى يطوف عليها الفجر، لتبدأ الصيام تباعاً، لتكتمل الدورة في 24 ساعة ويصوم جميع المسلمين بناءً على بداية كونية واحدة لا مجال فيها للاختلاف أو الأهواء.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-12 pt-10 border-t border-slate-200 text-center flex flex-col items-center justify-center pb-8">
                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-6 shadow-sm border border-indigo-100">
                  <BookOpen size={36} strokeWidth={1.5} />
                </div>
                <p className="text-slate-500 mb-2 font-bold tracking-wider">إعداد فكرة وتصميم التطبيق</p>
                <p className="text-3xl font-black text-indigo-900 font-serif mb-3">أحمد طلعت</p>
                <a href="mailto:ahmadalazab2022@gmail.com" className="text-indigo-600 hover:text-indigo-800 hover:underline font-mono text-lg transition-colors bg-indigo-50 px-4 py-2 rounded-lg">ahmadalazab2022@gmail.com</a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}