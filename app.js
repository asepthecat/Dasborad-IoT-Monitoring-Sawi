import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

const firebaseConfig = {
    databaseURL: "https://tanaman-sawi-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentMode = "auto";
let currentPompa = "OFF";
let currentLampu = "OFF";

// Variabel penampung nilai sensor terakhir untuk memfilter duplikasi log history
let lastSuhu = null, lastHum = null, lastAir = null, lastLdr = null, lastTds = null;

// TAMPILKAN HISTORY YANG SUDAH TERSIMPAN SAAT HALAMAN PERTAMA DIBUKA
window.addEventListener("DOMContentLoaded", () => {
    renderHistoryTable();
});

// MEMBACA DATA SENSOR & KONTROL DARI FIREBASE SECARA LIVE
const hidroponikRef = ref(db, "hidroponik");
onValue(hidroponikRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    if (data.sensor) {
        const suhu = data.sensor.dht_suhu ?? "--";
        const hum = data.sensor.dht_kelembaban ?? "--";
        const air = data.sensor.hcsr04_tinggi_air ?? "--";
        const ldr = data.sensor.ldr_cahaya ?? "--";
        const tds = data.sensor.tds_nutrisi ?? "--";

        // Update ke visual kartu utama
        document.getElementById("txt-suhu").innerText = suhu;
        document.getElementById("txt-kelembaban").innerText = hum;
        document.getElementById("txt-air").innerText = air;
        document.getElementById("txt-ldr").innerText = ldr;
        document.getElementById("txt-tds").innerText = tds;

        // LOGIKA PENYIMPANAN HISTORY: Simpan hanya jika ada nilai sensor yang berubah
        if (suhu !== lastSuhu || hum !== lastHum || air !== lastAir || ldr !== lastLdr || tds !== lastTds) {
            // Pastikan bukan pembacaan awal yang kosong (--)
            if (suhu !== "--" && hum !== "--") {
                saveToHistory(suhu, hum, air, ldr, tds);
                
                // Perbarui cache data terakhir
                lastSuhu = suhu; lastHum = hum; lastAir = air; lastLdr = ldr; lastTds = tds;
            }
        }
    }

    if (data.kontrol) {
        currentMode = data.kontrol.mode ?? "auto";
        currentPompa = data.kontrol.pompa ?? "OFF";
        currentLampu = data.kontrol.lampu ?? "OFF";
        updateUIControls();
    }
});

// FUNGSI MENYIMPAN DATA KE MEMORI LOKAL (LOCALSTORAGE)
function saveToHistory(suhu, hum, air, ldr, tds) {
    let historyData = JSON.parse(localStorage.getItem("hidroponik_history")) || [];
    
    // Ambil waktu jam operasional saat ini
    const sekarang = new Date();
    const waktuString = sekarang.toLocaleDateString("id-ID") + " " + sekarang.toLocaleTimeString("id-ID", {hour: '2-digit', minute:'2-digit', second:'2-digit'});

    const logBaru = {
        waktu: waktuString,
        suhu: suhu,
        kelembaban: hum,
        air: air,
        ldr: ldr,
        tds: tds
    };

    // Masukkan data baru di baris paling atas (indeks awal)
    historyData.unshift(logBaru);

    // Batasi maksimum menyimpan 100 riwayat saja agar browser tidak lag
    if (historyData.length > 100) {
        historyData.pop();
    }

    localStorage.setItem("hidroponik_history", JSON.stringify(historyData));
    renderHistoryTable();
}

// FUNGSI MEMASUKKAN DATA HISTORY KE TABEL HTML
function renderHistoryTable() {
    let historyData = JSON.parse(localStorage.getItem("hidroponik_history")) || [];
    const tableBody = document.getElementById("table-history-body");
    
    if (historyData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#999;">Belum ada riwayat data tercatat.</td></tr>`;
        return;
    }

    tableBody.innerHTML = historyData.map(log => `
        <tr>
            <td><b>${log.waktu}</b></td>
            <td>${log.suhu} °C</td>
            <td>${log.kelembaban} %</td>
            <td>${log.air} cm</td>
            <td>${log.ldr}</td>
            <td style="color: #ff9800; font-weight: bold;">${log.tds} PPM</td>
        </tr>
    `).join('');
}

// FUNGSI UNTUK MENGHAPUS SEMUA RIWAYAT
window.clearHistory = function() {
    if (confirm("Apakah kamu yakin ingin menghapus semua riwayat data sensor?")) {
        localStorage.removeItem("hidroponik_history");
        renderHistoryTable();
    }
};

// LOGIKA VISUAL KONTROL
function updateUIControls() {
    if (currentMode === "auto") {
        document.getElementById("btn-auto").classList.add("active");
        document.getElementById("btn-manual").classList.remove("active");
        document.getElementById("btn-pompa").disabled = true;
        document.getElementById("btn-lampu").disabled = true;
    } else {
        document.getElementById("btn-auto").classList.remove("active");
        document.getElementById("btn-manual").classList.add("active");
        document.getElementById("btn-pompa").disabled = false;
        document.getElementById("btn-lampu").disabled = false;
    }

    const statusPompaEl = document.getElementById("status-pompa");
    const btnPompaEl = document.getElementById("btn-pompa");
    statusPompaEl.innerText = "Status: " + currentPompa;
    if (currentPompa === "ON") {
        statusPompaEl.style.color = "#4caf50"; btnPompaEl.innerText = "MATIKAN POMPA"; btnPompaEl.classList.add("on");
    } else {
        statusPompaEl.style.color = "#f44336"; btnPompaEl.innerText = "HIDUPKAN POMPA"; btnPompaEl.classList.remove("on");
    }

    const statusLampuEl = document.getElementById("status-lampu");
    const btnLampuEl = document.getElementById("btn-lampu");
    statusLampuEl.innerText = "Status: " + currentLampu;
    if (currentLampu === "ON") {
        statusLampuEl.style.color = "#4caf50"; btnLampuEl.innerText = "MATIKAN LAMPU"; btnLampuEl.classList.add("on");
    } else {
        statusLampuEl.style.color = "#f44336"; btnLampuEl.innerText = "HIDUPKAN LAMPU"; btnLampuEl.classList.remove("on");
    }
}

window.setMode = function(modeBaru) {
    set(ref(db, "hidroponik/kontrol/mode"), modeBaru).catch(err => console.error(err));
};

window.toggleAktuator = function(jenis) {
    if (currentMode === "auto") return;
    if (jenis === "pompa") {
        set(ref(db, "hidroponik/kontrol/pompa"), currentPompa === "ON" ? "OFF" : "ON");
    } else if (jenis === "lampu") {
        set(ref(db, "hidroponik/kontrol/lampu"), currentLampu === "ON" ? "OFF" : "ON");
    }
};