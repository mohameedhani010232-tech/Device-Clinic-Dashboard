

(function setupLogin(){
  const normalizeDigits=(v)=>String(v||'').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\s+/g,'');
  const TOKEN_KEY='clinic_session_token';
  const init=()=>{
    const overlay=document.getElementById('login-overlay'),form=document.getElementById('login-form'),input=document.getElementById('login-code'),error=document.getElementById('login-error'),toggle=document.getElementById('toggle-login-code');
    if(!overlay||!form||!input) return Promise.resolve(false);
    const show=()=>overlay.classList.remove('hidden');
    const hide=()=>overlay.classList.add('hidden');
    const token=()=>sessionStorage.getItem(TOKEN_KEY) || '';
    const setToken=(value)=>{ sessionStorage.setItem(TOKEN_KEY,value); };
    const clearToken=()=>{ sessionStorage.removeItem(TOKEN_KEY); };

    window.clinicLogout=()=>{ clearToken(); show(); input.value=''; input.focus(); };
    window.clinicAuthToken=token;
    window.clinicAuthReady=new Promise(async resolve=>{
      const existing=token();
      if(existing){
        try{
          const r=await fetch('/api/auth/me',{headers:{Authorization:`Bearer ${existing}`},cache:'no-store'});
          if(r.ok){ hide(); return resolve(true); }
        }catch(_){}
        clearToken();
      }
      show();
      setTimeout(()=>input.focus(),150);
      const submit=async()=>{
        const code=normalizeDigits(input.value);
        if(!code){ error.textContent='اكتب رقم الدخول أولاً'; return; }
        input.disabled=true;
        error.textContent='جاري التحقق...';
        try{
          const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:code}),cache:'no-store'});
          const data=await response.json().catch(()=>({}));
          if(!response.ok || !data.success) throw new Error(data.message || 'تعذر تسجيل الدخول');
          setToken(data.token);
          error.textContent=''; input.value=''; hide(); resolve(true);
        }catch(e){
          clearToken(); error.textContent=e.message || 'رقم الدخول غير صحيح'; input.select();
          input.disabled=false;
        }
      };
      form.addEventListener('submit',e=>{e.preventDefault(); submit();});
      toggle&&toggle.addEventListener('click',()=>{const text=input.type==='text'; input.type=text?'password':'text'; toggle.textContent=text?'👁':'🙈'; input.focus();});
      input.addEventListener('input',()=>error.textContent='');
    });
    return window.clinicAuthReady;
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
// ===============================
// MongoDB client only
// ===============================


let patients = [];
let patientPrescriptions = {};
let patientLabs = {};
let currentEditingPrescription = null;
let currentEditingLab = null;



// ==================== بحث الأشعة والتحاليل ====================
const LAB_CUSTOM_ITEMS_KEY = 'clinic_custom_lab_radiology_v1';

const LAB_RADIOLOGY_CATALOG = [
    "X-Ray Chest PA",
    "X-Ray Chest AP",
    "X-Ray Abdomen",
    "X-Ray Pelvis",
    "X-Ray Cervical Spine",
    "X-Ray Thoracic Spine",
    "X-Ray Lumbar Spine",
    "X-Ray Lumbosacral Spine",
    "X-Ray Skull",
    "X-Ray Sinuses",
    "X-Ray Nasal Bones",
    "X-Ray Knee",
    "X-Ray Both Knees",
    "X-Ray Ankle",
    "X-Ray Foot",
    "X-Ray Hand",
    "X-Ray Wrist",
    "X-Ray Elbow",
    "X-Ray Shoulder",
    "X-Ray Hip",
    "X-Ray Femur",
    "X-Ray Tibia & Fibula",
    "X-Ray Whole Spine",
    "Ultrasound Abdomen & Pelvis",
    "Ultrasound Pelvis",
    "Ultrasound KUB",
    "Ultrasound Breast",
    "Ultrasound Thyroid",
    "Ultrasound Neck",
    "Ultrasound Doppler Lower Limbs",
    "Ultrasound Doppler Carotid",
    "CT Brain",
    "CT Chest",
    "CT Abdomen & Pelvis",
    "CT Abdomen",
    "CT Pelvis",
    "CT Paranasal Sinuses",
    "CT Spine",
    "CT Knee",
    "CT Angiography",
    "MRI Brain",
    "MRI Spine",
    "MRI Cervical Spine",
    "MRI Lumbar Spine",
    "MRI Knee",
    "MRI Shoulder",
    "MRI Abdomen & Pelvis",
    "Mammography",
    "DEXA Bone Density"
];

const LAB_ANALYSIS_CATALOG = [
    "Complete Blood Count (CBC)",
    "ESR",
    "CRP",
    "Blood Glucose - Fasting",
    "Blood Glucose - Random",
    "HbA1c",
    "Lipid Profile",
    "Total Cholesterol",
    "Triglycerides",
    "HDL Cholesterol",
    "LDL Cholesterol",
    "Liver Function Tests (LFT)",
    "ALT",
    "AST",
    "Bilirubin Total & Direct",
    "Kidney Function Tests",
    "Creatinine",
    "Urea",
    "Uric Acid",
    "Electrolytes",
    "Sodium",
    "Potassium",
    "Calcium",
    "Magnesium",
    "TSH",
    "Free T3",
    "Free T4",
    "Thyroid Profile",
    "Ferritin",
    "Serum Iron",
    "Vitamin B12",
    "Vitamin D",
    "Hb Electrophoresis",
    "PT",
    "INR",
    "PTT",
    "Blood Group",
    "Urine Analysis",
    "Urine Culture",
    "Stool Analysis",
    "Stool Culture",
    "Occult Blood in Stool",
    "Pregnancy Test (hCG)",
    "Hepatitis B Surface Antigen (HBsAg)",
    "Hepatitis C Antibody (HCV Ab)",
    "HIV 1 & 2 Antibodies",
    "Syphilis Test (VDRL)",
    "Blood Culture",
    "Semen Analysis"
];

let labSearchDropdown = null;
let activeLabSearchInput = null;

function normalizeLabSearch(value) {
    return String(value || '')
        .trim()
        .toLocaleLowerCase('ar-EG')
        .replace(/[أإآ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه');
}

function formatLabDisplayName(name) {
    return String(name || '').trim();
}

function getCustomLabItems() {
    try {
        const data = JSON.parse(localStorage.getItem(LAB_CUSTOM_ITEMS_KEY) || '[]');
        return Array.isArray(data) ? data : [];
    } catch (_) {
        return [];
    }
}

function saveCustomLabItems(items) {
    localStorage.setItem(LAB_CUSTOM_ITEMS_KEY, JSON.stringify(items));
}

function closeLabSearchDropdown() {
    if (labSearchDropdown) {
        labSearchDropdown.remove();
        labSearchDropdown = null;
    }
    activeLabSearchInput = null;
}

function positionLabSearchDropdown(input) {
    if (!labSearchDropdown) return;
    const rect = input.getBoundingClientRect();
    labSearchDropdown.style.left = Math.max(4, rect.left) + 'px';
    labSearchDropdown.style.top = (rect.bottom + 2) + 'px';
    labSearchDropdown.style.width = Math.max(360, rect.width) + 'px';
}

function addLabGroup(dropdown, title, items, query) {
    const normalizedQuery = normalizeLabSearch(query);
    const matches = items.filter(name => {
        if (!normalizedQuery) return true;
        // البحث من بداية أول كلمة فقط.
        return normalizeLabSearch(name).startsWith(normalizedQuery);
    });

    if (!matches.length) return 0;

    const header = document.createElement('div');
    header.className = 'lab-search-group-title';
    header.textContent = title;
    dropdown.appendChild(header);

    matches.forEach(name => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'lab-search-option';
        option.textContent = formatLabDisplayName(name);
        option.addEventListener('mousedown', function (event) {
            event.preventDefault();
            activeLabSearchInput.value = option.textContent;
            closeLabSearchDropdown();
        });
        dropdown.appendChild(option);
    });

    return matches.length;
}

function showLabSearchDropdown(input) {
    const query = normalizeLabSearch(input.value);
    closeLabSearchDropdown();

    // عند الضغط على الخانة تظهر القائمة فورًا، والكتابة بعدها تعمل فلترة.
    // البحث غير حساس لحالة الحروف (Capital / Small).

    const custom = getCustomLabItems();
    const customRadiology = custom.filter(x => x.type === 'radiology').map(x => x.name);
    const customLabs = custom.filter(x => x.type === 'lab').map(x => x.name);

    const radiology = [...new Set([...LAB_RADIOLOGY_CATALOG, ...customRadiology])];
    const labs = [...new Set([...LAB_ANALYSIS_CATALOG, ...customLabs])];

    const dropdown = document.createElement('div');
    dropdown.className = 'lab-search-dropdown no-print';
    labSearchDropdown = dropdown;
    activeLabSearchInput = input;

    let count = 0;
    count += addLabGroup(dropdown, 'قسم الأشعة', radiology, query);
    count += addLabGroup(dropdown, 'قسم التحاليل', labs, query);

    if (!count) {
        const empty = document.createElement('div');
        empty.className = 'lab-search-empty';
        empty.textContent = 'لا توجد نتيجة — استخدم زر إضافة أشعة / تحليل';
        dropdown.appendChild(empty);
    }

    document.body.appendChild(dropdown);
    positionLabSearchDropdown(input);
}

function addCustomLabOrRadiology() {
    const typeChoice = window.prompt('اكتب 1 لإضافة أشعة أو 2 لإضافة تحليل:');
    if (typeChoice !== '1' && typeChoice !== '2') return;

    const name = window.prompt(typeChoice === '1' ? 'اكتب اسم الأشعة:' : 'اكتب اسم التحليل:');
    if (!name || !name.trim()) return;

    const item = {
        type: typeChoice === '1' ? 'radiology' : 'lab',
        name: name.trim()
    };

    const items = getCustomLabItems();
    const exists = items.some(x =>
        x.type === item.type &&
        normalizeLabSearch(x.name) === normalizeLabSearch(item.name)
    );

    if (!exists) {
        items.push(item);
        saveCustomLabItems(items);
    }

    if (activeLabSearchInput) {
        activeLabSearchInput.value = item.name;
        closeLabSearchDropdown();
    } else {
        alert('تمت إضافة ' + (item.type === 'radiology' ? 'الأشعة' : 'التحليل') + ': ' + item.name);
    }
}

function setupLabSearchInputs() {
    document.querySelectorAll('.lab-search-input').forEach(input => {
        if (input.dataset.labSearchReady === '1') return;
        input.dataset.labSearchReady = '1';

        input.addEventListener('input', function () {
            showLabSearchDropdown(this);
        });
        input.addEventListener('focus', function () {
            showLabSearchDropdown(this);
        });
        input.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') closeLabSearchDropdown();
        });
    });
}

document.addEventListener('click', function (event) {
    if (!event.target.closest('.lab-search-dropdown') &&
        !event.target.classList.contains('lab-search-input')) {
        closeLabSearchDropdown();
    }
});

window.addEventListener('resize', function () {
    if (labSearchDropdown && activeLabSearchInput) {
        positionLabSearchDropdown(activeLabSearchInput);
    }
});

window.addEventListener('scroll', function () {
    if (labSearchDropdown && activeLabSearchInput) {
        positionLabSearchDropdown(activeLabSearchInput);
    }
}, true);

document.addEventListener('DOMContentLoaded', setupLabSearchInputs);

// ==================== نهاية بحث الأشعة والتحاليل ====================


// ==================== بحث الأدوية ====================
const MEDICINES_DATA_URL = 'https://raw.githubusercontent.com/karem505/egyptian-drug-database/main/data/egyptian-drugs.json';
const MEDICINES_CACHE_KEY = 'clinic_medicines_catalog_v2';
const CUSTOM_MEDICINES_KEY = 'clinic_custom_medicines_v1';
let medicinesCatalog = [];
let medicineDropdown = null;
let medicineDropdownInput = null;

function normalizeMedicineSearch(value) {
    return String(value || '')
        .trim()
        .toLocaleLowerCase('ar-EG')
        .replace(/[أإآ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه');
}

function formatMedicineDisplayName(name) {
    return String(name || '')
        .trim()
        .split(/\s+/)
        .map(word => {
            if (!word) return word;
            return word.charAt(0).toLocaleUpperCase('en-US') +
                   word.slice(1).toLocaleLowerCase('en-US');
        })
        .join(' ');
}

function getMedicineFirstWord(name) {
    return normalizeMedicineSearch(name).split(/\s+/)[0] || '';
}

function getCustomClinicMedicines() {
    try {
        const list = JSON.parse(localStorage.getItem(CUSTOM_MEDICINES_KEY) || '[]');
        return Array.isArray(list) ? list : [];
    } catch (_) {
        return [];
    }
}

function getAllMedicineNames() {
    return [...new Set([...medicinesCatalog, ...getCustomClinicMedicines()])];
}

function saveCustomClinicMedicines(list) {
    localStorage.setItem(CUSTOM_MEDICINES_KEY, JSON.stringify(list));
}

function addCustomClinicMedicine() {
    const name = window.prompt('اكتب اسم الدواء الجديد:');
    if (!name || !name.trim()) return;

    const cleanName = formatMedicineDisplayName(name.trim());
    const normalized = normalizeMedicineSearch(cleanName);
    const custom = getCustomClinicMedicines();

    if (!getAllMedicineNames().some(x => normalizeMedicineSearch(x) === normalized)) {
        custom.push(cleanName);
        saveCustomClinicMedicines(custom);
    }

    const activeInput = document.activeElement &&
        document.activeElement.classList.contains('desc-input')
        ? document.activeElement : null;

    if (activeInput) {
        activeInput.value = cleanName;
        closeMedicineDropdown();
    } else {
        alert('تمت إضافة الدواء: ' + cleanName);
    }
}

function closeMedicineDropdown() {
    if (medicineDropdown) {
        medicineDropdown.remove();
        medicineDropdown = null;
    }
    medicineDropdownInput = null;
}

function positionMedicineDropdown(input) {
    if (!medicineDropdown) return;
    const rect = input.getBoundingClientRect();
    medicineDropdown.style.left = Math.max(4, rect.left) + 'px';
    medicineDropdown.style.top = (rect.bottom + 2) + 'px';
    medicineDropdown.style.width = Math.max(320, rect.width) + 'px';
}

function showMedicineDropdown(input) {
    const query = normalizeMedicineSearch(input.value);
    closeMedicineDropdown();

    // عند الضغط على الخانة تظهر القائمة فورًا، والكتابة بعدها تعمل فلترة.
    // البحث غير حساس لحالة الحروف (Capital / Small).

    const matches = getAllMedicineNames()
        .filter(name => normalizeMedicineSearch(name).startsWith(query))
        .sort((a, b) => a.localeCompare(b));

    const dropdown = document.createElement('div');
    dropdown.className = 'medicine-search-dropdown no-print';
    medicineDropdown = dropdown;
    medicineDropdownInput = input;

    if (!matches.length) {
        const empty = document.createElement('div');
        empty.className = 'medicine-empty-result';
        empty.textContent = 'لا توجد نتيجة — اضغط ＋ إضافة دواء';
        dropdown.appendChild(empty);
    } else {
        // لا يوجد limit للنتائج: القائمة قابلة للتمرير حتى آخر نتيجة.
        matches.forEach(name => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'medicine-search-option';
            item.textContent = formatMedicineDisplayName(name);
            item.addEventListener('mousedown', function (event) {
                event.preventDefault();
                input.value = item.textContent;
                closeMedicineDropdown();
            });
            dropdown.appendChild(item);
        });
    }

    document.body.appendChild(dropdown);
    positionMedicineDropdown(input);
}

function setupMedicineSearch() {
    document.querySelectorAll('.desc-input').forEach(input => {
        if (input.dataset.medicineSearchReady === '1') return;
        input.dataset.medicineSearchReady = '1';

        input.addEventListener('input', function () {
            showMedicineDropdown(this);
        });

        input.addEventListener('focus', function () {
            showMedicineDropdown(this);
        });

        input.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') closeMedicineDropdown();
        });
    });
}

async function loadMedicinesCatalog() {
    // نستخدم النسخة المحفوظة أولًا حتى لا يتعطل البحث عند ضعف الإنترنت.
    try {
        const cached = JSON.parse(localStorage.getItem(MEDICINES_CACHE_KEY) || 'null');
        if (Array.isArray(cached) && cached.length) {
            medicinesCatalog = cached;
        }
    } catch (_) {}

    try {
        const response = await fetch(MEDICINES_DATA_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        const names = [...new Set((data || [])
            .map(item => String(item?.commercial_name_en || item?.name || '').trim())
            .filter(Boolean))];

        if (names.length) {
            medicinesCatalog = names;
            localStorage.setItem(MEDICINES_CACHE_KEY, JSON.stringify(names));
        }
    } catch (error) {
        console.warn('تعذر تحديث قائمة الأدوية:', error);
    }

    setupMedicineSearch();
}

document.addEventListener('click', function (event) {
    if (!event.target.closest('.medicine-search-dropdown') &&
        !event.target.classList.contains('desc-input')) {
        closeMedicineDropdown();
    }
});

window.addEventListener('resize', function () {
    if (medicineDropdown && medicineDropdownInput) {
        positionMedicineDropdown(medicineDropdownInput);
    }
});

window.addEventListener('scroll', function () {
    if (medicineDropdown && medicineDropdownInput) {
        positionMedicineDropdown(medicineDropdownInput);
    }
}, true);

// ==================== نهاية بحث الأدوية ====================

let isShowingAllPatients = false;
let remoteRefreshInFlight = false;

function showToast(message, type = 'success') {
    const existing = document.getElementById('app-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.textContent = message;
    toast.style.cssText = `position:fixed;top:20px;right:20px;z-index:99999;max-width:420px;padding:12px 18px;border-radius:10px;color:#fff;background:${type === 'error' ? '#dc2626' : '#16a34a'};box-shadow:0 8px 24px rgba(0,0,0,.18);font-size:15px;line-height:1.6;`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2600);
}


// دالة قراءة الصورة وضغطها لتفادي البطء والتهنيج
function previewImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 300;
            const MAX_HEIGHT = 300;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
            const imgElement = document.getElementById('imagePreview');
            imgElement.src = compressedBase64;
            imgElement.style.display = 'block';
            document.getElementById('pImageBase64').value = compressedBase64;
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

let jobOptions = [];

function saveJobOptions() {
    localStorage.setItem('clinic_job_options', JSON.stringify(jobOptions));
}

function fillJobOptions(selectedValue = '') {
    const select = document.getElementById('pJob');
    if (!select) return;

    const currentValue = selectedValue || select.value || '';
    select.innerHTML = '';
    select.appendChild(new Option('اختر الدرجة المالية / الوظيفة', ''));

    jobOptions.forEach(optionText => {
        select.appendChild(new Option(optionText, optionText));
    });

    if (currentValue) {
        select.value = currentValue;
    }
}

function toggleJobInput(show = null) {
    const block = document.getElementById('jobAddBlock');
    if (!block) return;

    const shouldShow = show === null ? block.style.display === 'none' : show;
    block.style.display = shouldShow ? 'flex' : 'none';

    if (shouldShow) {
        const input = document.getElementById('newJobInput');
        if (input) {
            input.value = '';
            input.focus();
        }
    }
}

function addJobOption() {
    const input = document.getElementById('newJobInput');
    if (!input) return;

    const value = input.value.trim();
    if (!value) {
        alert('اكتب اسم الوظيفة أولاً');
        input.focus();
        return;
    }

    if (jobOptions.includes(value)) {
        alert('هذه الوظيفة موجودة بالفعل');
        return;
    }

    jobOptions.push(value);
    saveJobOptions();
    if (isRemoteEnabled()) {
        saveRemoteJobOption(value);
    }
    fillJobOptions(value);
    toggleJobInput(false);
}

// دالة لتوليد الـ 22 صف لجدول الروشتة ديناميكياً لتنظيف كود الـ HTML
function generateRxTableRows() {
    const rxTableBody = document.getElementById('rxTableBody');
    if (rxTableBody) {
        let rowsHtml = '';
        for (let i = 1; i <= 22; i++) {
            rowsHtml += `
                <tr>
                    <td>${i}</td>
                    <td><input type="text" list="medicines-list" class="clean-input desc-input" ></td>
                    <td><input type="number" class="clean-input"></td>
                    <td><input type="number" class="clean-input"></td><td><input type="number" class="clean-input"></td>
                    <td><input type="number" class="clean-input"></td><td><input type="number" class="clean-input"></td>
                    <td><input type="number" class="clean-input" ></td><td><input type="number" class="clean-input" ></td>
                    <td><input type="number" class="clean-input" ></td><td><input type="number" class="clean-input" ></td>
                    <td><input type="number" class="clean-input" ></td><td><input type="number" class="clean-input" ></td>
                </tr>
            `;
        }
        rxTableBody.innerHTML = rowsHtml;
        setupMedicineSearch();
    }
}

function saveToStorage() {
    // بيانات المرضى والروشتات والتحاليل لا تُخزن محليًا؛ MongoDB هو المصدر الوحيد للحقيقة.
    saveJobOptions();
}

function setCurrentDate() {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const dateStr = `${dd} / ${mm} / ${yyyy}`;
    const dateField = document.getElementById('rxDate');
    if (dateField) dateField.value = dateStr;

    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        input.value = `${yyyy}-${mm}-${dd}`;
    });
}

// دالة لتغيير التبويبات حسب التقسيمة الجديدة مع تفعيل البحث التلقائي
function switchTab(tabId, element = null) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));

    const menuItems = document.querySelectorAll('.sidebar-menu li');
    menuItems.forEach(item => item.classList.remove('active'));

    const selectedTab = document.getElementById(tabId);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    if (element) {
        element.classList.add('active');
    }

    // التركيز التلقائي على حقل البحث عند فتح تبويب البحث
    if (tabId === 'search-patient-tab') {
        setTimeout(() => {
            const searchInput = document.getElementById('patientSearchInput');
            if (searchInput) {
                searchInput.focus();
            }
        }, 100);
    }
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderPatientsTable(dataToRender = patients) {
    const tbody = document.getElementById('patientsTableBody');
    if (!tbody) return;

    if (dataToRender.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="color: #64748b;">لا توجد بيانات مسجلة.</td></tr>`;
        return;
    }

    // إخفاء جميع المرضى حتى يتم الضغط على الزر أو البحث
    if (!isShowingAllPatients && dataToRender === patients) {
        tbody.innerHTML = `<tr><td colspan="7" style="color: #64748b;">قاعدة البيانات مخفية. ابدأ بكتابة اسم/رقم المريض للبحث، أو اضغط على "👁️ إظهار القائمة" لعرض الكل.</td></tr>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    dataToRender.forEach((p, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><b>${index + 1}</b></td>
            <td><b>${escapeHtml(p.nationalId || '-')}</b></td>
            <td><a href="#" onclick="viewPatientProfile('${p.id}'); return false;" style="color: #0284c7; font-weight: bold; text-decoration: none;">${escapeHtml(p.name || '-')}</a></td>
            <td>${escapeHtml(p.system || '-')}</td>
            <td>${escapeHtml(p.doctorName || '-')}</td>
            <td>${escapeHtml(p.job || '-')}</td>
            <td>
                <button class="btn btn-primary" style="padding: 5px 10px; font-size: 13px;" onclick="viewPatientProfile('${p.id}')">عرض الصفحة</button>
                <button class="btn btn-warning" style="padding: 5px 10px; font-size: 13px;" onclick="editPatient('${p.id}')">تعديل</button>
                <button class="btn btn-danger" style="padding: 5px 10px; font-size: 13px;" onclick="deletePatient('${p.id}')">حذف</button>
            </td>
        `;
        fragment.appendChild(tr);
    });

    tbody.textContent = '';
    tbody.appendChild(fragment);
}

function updatePatientsViewButton() {
    const button = document.getElementById('togglePatientsViewBtn');
    if (!button) return;

    if (isShowingAllPatients) {
        button.textContent = '🙈 إخفاء القائمة';
        button.title = 'إخفاء قاعدة بيانات المرضى';
    } else {
        button.textContent = '👁️ إظهار القائمة';
        button.title = 'إظهار قاعدة بيانات المرضى';
    }
}

function togglePatientsView() {
    isShowingAllPatients = !isShowingAllPatients;
    renderPatientsTable(patients);
    updatePatientsViewButton();
}

document.getElementById('patientForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const idField = document.getElementById('patientId').value;
    const medicalId = document.getElementById('pNationalId').value.trim();
    const idCard = document.getElementById('pIdCard').value.trim();
    const name = document.getElementById('pName').value.trim();
    const system = document.getElementById('pSystem').value.trim();
    const job = document.getElementById('pJob').value.trim();
    const doctorName = document.getElementById('pDoctorName').value.trim();
    const imageBase64 = document.getElementById('pImageBase64').value;

    if (!medicalId || !name || !doctorName) {
        showToast('من فضلك أكمل الاسم والرقم الطبي واسم الطبيب.', 'error');
        return;
    }

    const oldPatient = idField ? patients.find(p => p.id === idField) : null;
    const existingPatientWithSameMedicalId = patients.find(
        p => p.nationalId === medicalId && p.id !== idField
    );
    if (existingPatientWithSameMedicalId) {
        showToast(`الرقم الطبي (${medicalId}) مسجل بالفعل للمريض "${existingPatientWithSameMedicalId.name}". استخدم رقمًا طبيًا مختلفًا.`, 'error');
        return;
    }

    if (idCard) {
        const existingPatientWithSameCard = patients.find(
            p => p.idCard && p.idCard === idCard && p.id !== idField
        );
        if (existingPatientWithSameCard) {
            showToast(`رقم البطاقة (${idCard}) مسجل بالفعل للمريض "${existingPatientWithSameCard.name}".`, 'error');
            return;
        }
    }

    const patient = {
        id: idField || Date.now().toString(),
        remoteId: oldPatient?.remoteId || null,
        nationalId: medicalId,
        idCard,
        name,
        system,
        job,
        doctorName,
        image: imageBase64
    };

    // MongoDB هو المصدر الأساسي. لا نعتبر المريض محفوظًا إلا بعد نجاح الحفظ المركزي.
    if (!isRemoteEnabled()) {
        showToast('قاعدة البيانات غير متاحة حاليًا. لم يتم حفظ المريض. حاول مرة أخرى بعد عودة الاتصال.', 'error');
        return;
    }

    const submitButton = document.querySelector('#patientForm button[type="submit"]');
    const originalButtonText = submitButton?.textContent || 'حفظ وتسجيل المريض';
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.dataset.originalText = originalButtonText;
        submitButton.textContent = 'جاري الحفظ...';
    }

    try {
        const savedRemote = await savePatientToRemote(patient);
        if (!savedRemote) throw new Error('لم يرجع الخادم بيانات المريض بعد الحفظ.');

        const savedPatient = {
            ...patient,
            id: savedRemote._id,
            remoteId: savedRemote._id,
            nationalId: savedRemote.medicalId || medicalId,
            idCard: savedRemote.nationalId || idCard,
            name: savedRemote.name || name,
            system: savedRemote.system || system,
            job: savedRemote.job || job,
            doctorName: savedRemote.doctorName || doctorName,
            image: savedRemote.imageUrl || imageBase64
        };

        if (idField && oldPatient && oldPatient.nationalId !== savedPatient.nationalId) {
            if (patientPrescriptions[oldPatient.nationalId]) {
                patientPrescriptions[savedPatient.nationalId] = patientPrescriptions[oldPatient.nationalId];
                delete patientPrescriptions[oldPatient.nationalId];
            }
            if (patientLabs[oldPatient.nationalId]) {
                patientLabs[savedPatient.nationalId] = patientLabs[oldPatient.nationalId];
                delete patientLabs[oldPatient.nationalId];
            }
        }

        if (idField) {
            patients = patients.map(p => p.id === idField ? savedPatient : p);
            if (!patients.some(p => p.id === savedPatient.id)) {
                patients.unshift(savedPatient);
            }
        } else {
            // نستبدل النسخة المحلية المؤقتة (إن وجدت) بالنسخة القادمة من MongoDB.
            patients = patients.filter(p => p.id !== patient.id && p.remoteId !== savedPatient.remoteId);
            patients.unshift(savedPatient);
        }

        saveToStorage();
        isShowingAllPatients = true;
        renderPatientsTable(patients);
        renderDashboard();
        resetForm();
        switchTab('search-patient-tab');
        showToast(idField ? 'تم تحديث بيانات المريض وحفظها في قاعدة البيانات.' : 'تم تسجيل المريض وحفظه في قاعدة البيانات.');
    } catch (err) {
        console.error('Remote patient save error:', err);
        showToast(`تعذر حفظ المريض في قاعدة البيانات: ${err.message || err}`, 'error');
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = submitButton.dataset.originalText || originalButtonText;
        }
    }
});

function editPatient(id) {
    const p = patients.find(item => item.id === id);
    if (p) {
        document.getElementById('patientId').value = p.id;
        document.getElementById('pNationalId').value = p.nationalId || '';
        document.getElementById('pIdCard').value = p.idCard || '';
        document.getElementById('pName').value = p.name || '';
        document.getElementById('pSystem').value = p.system || '';
        document.getElementById('pJob').value = p.job || '';
        document.getElementById('pDoctorName').value = p.doctorName || '';

        document.getElementById('pImageBase64').value = p.image || '';
        const imgPreview = document.getElementById('imagePreview');
        if (p.image) {
            imgPreview.src = p.image;
            imgPreview.style.display = 'block';
        } else {
            imgPreview.style.display = 'none';
        }

        document.getElementById('form-title').innerText = 'تعديل بيانات المريض';
        document.getElementById('saveBtn').innerText = 'تحديث البيانات';
        document.getElementById('cancelEditBtn').style.display = 'inline-block';

        switchTab('add-patient-tab');
    }
}

async function deletePatient(id) {
    if (confirm('هل أنت متأكد من حذف هذا المريض من السجل؟')) {
        const p = patients.find(item => item.id === id);

        if (p && p.nationalId) {
            delete patientPrescriptions[p.nationalId];
            delete patientLabs[p.nationalId];
        }

        if (p && p.remoteId && isRemoteEnabled()) {
            try {
                await deletePatientFromRemote(p.remoteId);
            } catch (err) {
                console.warn('Remote patient delete warning:', err);
            }
        }

        patients = patients.filter(item => item.id !== id);

        saveToStorage();
        renderPatientsTable(patients);
        renderDashboard();
    }
}

function resetForm() {
    document.getElementById('patientForm').reset();
    document.getElementById('patientId').value = '';
    document.getElementById('form-title').innerText = 'تسجيل مريض جديد';
    document.getElementById('saveBtn').innerText = 'حفظ وتسجيل المريض';
    document.getElementById('cancelEditBtn').style.display = 'none';

    document.getElementById('pSystem').value = 'جهاز مدينة العبور';
    document.getElementById('pImageBase64').value = '';
    document.getElementById('pImage').value = '';
    const imgPreview = document.getElementById('imagePreview');
    imgPreview.src = '';
    imgPreview.style.display = 'none';
}

function resetPrescriptionForm() {
    currentEditingPrescription = null;
    document.getElementById('rxCardSearch').value = '';
    document.getElementById('rxSystem').value = '';
    document.getElementById('rxName').value = '';
    document.getElementById('rxJob').value = '';
    document.getElementById('rxCardDisplay').value = '';
    document.getElementById('rxDoctor').value = '';
    document.querySelectorAll('.patient-name-input').forEach(input => input.value = '');

    const rows = document.querySelectorAll('#rxTableBody tr');
    rows.forEach((row) => {
        const inputs = row.querySelectorAll('input');
        inputs.forEach(input => input.value = '');
    });
}

function resetLabForm() {
    currentEditingLab = null;
    document.getElementById('labCardSearch').value = '';
    document.getElementById('labJob').value = '';
    document.getElementById('labSystem').value = '';
    document.querySelectorAll('.patient-name-input').forEach(input => input.value = '');

    const labRows = document.querySelectorAll('.lab-list-item');
    labRows.forEach((row) => {
        row.querySelector('.lab-desc-input').value = '';
        row.querySelector('.lab-val-input').value = '';
    });
}

function fetchPatientByNationalId(nid, formType) {
    nid = (nid || '').trim();
    const found = patients.find(p => p.nationalId === nid);

    if (found) {
        const patientName = found.name || '';

        if (formType === 'rx') {
            document.getElementById('rxSystem').value = found.system || '';
            document.getElementById('rxName').value = patientName;
            document.getElementById('rxJob').value = found.job || '';
            document.getElementById('rxCardDisplay').value = found.idCard || found.nationalId || '';
            document.getElementById('rxDoctor').value = found.doctorName || '';
            document.querySelectorAll('.patient-name-input').forEach(input => input.value = patientName);
        } else if (formType === 'lab') {
            document.querySelectorAll('.patient-name-input').forEach(input => input.value = patientName);
            document.getElementById('labJob').value = found.job || '';
            document.getElementById('labSystem').value = found.system || '';
        }
    } else {
        alert('غير موجود');

        if (formType === 'rx') {
            document.getElementById('rxSystem').value = '';
            document.getElementById('rxName').value = '';
            document.getElementById('rxJob').value = '';
            document.getElementById('rxCardDisplay').value = '';
            document.getElementById('rxDoctor').value = '';
            document.querySelectorAll('.patient-name-input').forEach(input => input.value = '');
        } else if (formType === 'lab') {
            document.querySelectorAll('.patient-name-input').forEach(input => input.value = '');
            document.getElementById('labJob').value = '';
            document.getElementById('labSystem').value = '';
        }
    }
}

let currentProfilePatientId = null;
function viewPatientProfile(id) {
    const p = patients.find(item => item.id === id);
    if (p) {
        currentProfilePatientId = p.id;
        document.getElementById('profileTitle').innerText = `ملف المريض: ${p.name}`;

        const imgSrc = p.image ? p.image : 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

        document.getElementById('profileDetailsContent').innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 20px;">
                <div style="flex: 1; min-width: 300px;">
                    <p><b>الرقم الطبي:</b> ${escapeHtml(p.nationalId || 'غير محدد')}</p>
                    <p><b>رقم البطاقة الشخصية:</b> ${escapeHtml(p.idCard || 'غير محدد')}</p>
                    <p><b>اسم المريض:</b> ${escapeHtml(p.name || '')}</p>
                    <p><b>المنظومة / الجهة:</b> ${escapeHtml(p.system || 'غير محدد')}</p>
                    <p><b>اسم الطبيب:</b> ${escapeHtml(p.doctorName || 'غير محدد')}</p>
                    <p><b>الدرجة المالية / الوظيفة:</b> ${escapeHtml(p.job || 'غير محدد')}</p>
                </div>
                
                <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                    <img src="${imgSrc}" alt="صورة المريض" style="width: 150px; height: 150px; border-radius: 12px; object-fit: cover; border: 3px solid #0284c7; padding: 3px; background: #fff;">
                </div>
            </div>
            
            <hr style="margin: 15px 0; border:0; border-top:1px solid #cbd5e1;">
            <div style="margin-top: 10px; display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="btn btn-warning" onclick="editPatient('${p.id}')">تعديل بياناته</button>
            </div>
        `;

        renderPatientPrescriptionsHistory(p.nationalId);
        renderPatientLabsHistory(p.nationalId);

        switchTab('patient-profile-tab', null);
    }
}

function printPrescriptionSheet() {
    switchTab('prescription-tab', document.querySelectorAll('.sidebar-menu li')[1]);
    setTimeout(() => {
        const printArea = document.getElementById('prescriptionPrintArea');
        if (printArea) {
            printArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        window.print();
    }, 150);
}

function printLabSheet() {
    switchTab('lab-tab', document.querySelectorAll('.sidebar-menu li')[2]);
    setTimeout(() => {
        const printArea = document.getElementById('labPrintArea');
        if (printArea) {
            printArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        window.print();
    }, 150);
}

window.addEventListener('beforeprint', function () {
    document.querySelectorAll('input').forEach(input => {
        input.setAttribute('value', input.value);
    });
});

async function savePrescriptionToPatient() {
    const nationalId = document.getElementById('rxCardSearch').value.trim();
    if (!nationalId) {
        alert('الرجاء إدخال أو جلب الرقم الطبي للمريض أولاً لربط الروشتة بملفه!');
        return;
    }

    const p = patients.find(item => item.nationalId === nationalId);
    if (!p) {
        alert('المريض غير موجود في سجل المرضى.');
        return;
    }

    let medicines = [];
    const rows = document.querySelectorAll('#rxTableBody tr');
    rows.forEach((row) => {
        const inputs = row.querySelectorAll('input');
        const medInput = inputs[0].value.trim();
        if (medInput) {
            medicines.push({
                name: medInput, qty: inputs[1].value.trim(),
                localPt: inputs[2].value.trim(), localEgp: inputs[3].value.trim(),
                impPt: inputs[4].value.trim(), impEgp: inputs[5].value.trim(),
                totalPt: inputs[6].value.trim(), totalEgp: inputs[7].value.trim(),
                qtrPt: inputs[8].value.trim(), qtrEgp: inputs[9].value.trim(),
                devPt: inputs[10].value.trim(), devEgp: inputs[11].value.trim()
            });
        }
    });

    if (!medicines.length) {
        alert('الرجاء كتابة دواء واحد على الأقل في الروشتة قبل الحفظ!');
        return;
    }

    const rxData = {
        date: document.getElementById('rxDate').value,
        doctor: document.getElementById('rxDoctor').value || 'غير محدد',
        medicines
    };

    let existingRemoteId = null;
    if (currentEditingPrescription && currentEditingPrescription.nationalId === nationalId) {
        existingRemoteId = patientPrescriptions[nationalId]?.[currentEditingPrescription.index]?.remoteId || null;
    }

    if (!isRemoteEnabled()) {
        alert('قاعدة البيانات غير متاحة حاليًا. لم يتم حفظ الروشتة.');
        return;
    }
    try {
        const targetId = p.remoteId || p.nationalId;
        const remoteId = await savePrescriptionToRemote(targetId, rxData, existingRemoteId);
        if (!remoteId && !existingRemoteId) throw new Error('الخادم لم يؤكد حفظ الروشتة.');
        if (remoteId) rxData.remoteId = remoteId;
    } catch (err) {
        alert(`تعذر حفظ الروشتة في قاعدة البيانات: ${err.message}`);
        return;
    }

    if (!patientPrescriptions[nationalId]) patientPrescriptions[nationalId] = [];

    if (currentEditingPrescription && currentEditingPrescription.nationalId === nationalId) {
        patientPrescriptions[nationalId][currentEditingPrescription.index] = {
            ...rxData, remoteId: rxData.remoteId || existingRemoteId
        };
        currentEditingPrescription = null;
    } else {
        patientPrescriptions[nationalId].unshift(rxData);
    }

    await refreshPatientRecords(nationalId);
    saveToStorage();
    renderDashboard();
    viewPatientProfile(p.id);
    alert('تم حفظ الروشتة في قاعدة البيانات وملف المريض بنجاح!');
}

async function saveCurrentPatientProfile() {
    const nationalId = document.getElementById('labCardSearch').value.trim();
    if (!nationalId) {
        alert('الرجاء إدخال أو جلب الرقم الطبي للمريض أولاً لربط طلب التحاليل والأشعة بملفه!');
        return;
    }

    const p = patients.find(item => item.nationalId === nationalId);
    if (!p) {
        alert('المريض غير موجود في سجل المرضى.');
        return;
    }

    let labItems = [];
    const labRows = document.querySelectorAll('.lab-list-item');
    labRows.forEach((row, index) => {
        const descInput = row.querySelector('.lab-desc-input').value.trim();
        const valInput = row.querySelector('.lab-val-input').value.trim();
        if (descInput) labItems.push(`فحص (${index + 1}): ${descInput} - القيمة: ${valInput || 'غير محدد'}`);
    });

    if (!labItems.length) {
        alert('الرجاء كتابة فحص أو تحليل واحد على الأقل قبل الحفظ!');
        return;
    }

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const labData = { date: `${dd} / ${mm} / ${yyyy}`, details: labItems.join(' | ') };

    let existingRemoteLabId = null;
    if (currentEditingLab && currentEditingLab.nationalId === nationalId) {
        existingRemoteLabId = patientLabs[nationalId]?.[currentEditingLab.index]?.remoteId || null;
    }

    if (!isRemoteEnabled()) {
        alert('قاعدة البيانات غير متاحة حاليًا. لم يتم حفظ طلب الفحص.');
        return;
    }
    try {
        const targetId = p.remoteId || p.nationalId;
        const remoteId = await saveLabToRemote(targetId, labData, existingRemoteLabId);
        if (!remoteId && !existingRemoteLabId) throw new Error('الخادم لم يؤكد حفظ طلب الفحص.');
        if (remoteId) labData.remoteId = remoteId;
    } catch (err) {
        alert(`تعذر حفظ طلب الفحص في قاعدة البيانات: ${err.message}`);
        return;
    }

    if (!patientLabs[nationalId]) patientLabs[nationalId] = [];

    if (currentEditingLab && currentEditingLab.nationalId === nationalId) {
        patientLabs[nationalId][currentEditingLab.index] = {
            ...labData, remoteId: labData.remoteId || existingRemoteLabId
        };
        currentEditingLab = null;
    } else {
        patientLabs[nationalId].unshift(labData);
    }

    await refreshPatientRecords(nationalId);
    saveToStorage();
    renderDashboard();
    viewPatientProfile(p.id);
    alert('تم حفظ طلب التحاليل والأشعة في قاعدة البيانات وملف المريض بنجاح!');
}

function renderPatientPrescriptionsHistory(nationalId) {
    const container = document.getElementById('patientPrescriptionsHistory');
    const rxList = patientPrescriptions[nationalId] || [];

    if (rxList.length === 0) {
        container.innerHTML = `<p style="color: #64748b;">لا توجد روشتات مسجلة لهذا المريض حتى الآن.</p>`;
        return;
    }

    let html = `<div style="display: flex; flex-direction: column; gap: 10px;">`;
    rxList.forEach((rx, idx) => {
        const medicinesText = rx.medicines.map(m => typeof m === 'object' ? `${m.name} (الكمية: ${m.qty || 1})` : m).join(' | ');
        html += `
            <div style="background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #cbd5e1;">
                <p><b>روشتة بتاريخ:</b> ${rx.date} | <b>الطبيب:</b> ${rx.doctor}
                   <span style="float: left; display: inline-flex; gap: 5px; flex-wrap: wrap;">
                       <button class="btn btn-primary" style="padding:2px 6px; font-size:11px;" onclick="loadPrescriptionRecordIntoForm('${nationalId}', ${idx})">تعديل/عرض</button>
                       <button class="btn btn-warning" style="padding:2px 6px; font-size:11px;" onclick="printPrescriptionRecord('${nationalId}', ${idx})">طباعة</button>
                       <button class="btn btn-danger" style="padding:2px 6px; font-size:11px;" onclick="deletePrescriptionRecord('${nationalId}', ${idx})">حذف</button>
                   </span>
                </p>
                <p style="font-size: 14px; color: #334155; margin-top: 5px;"><b>الأدوية:</b> ${medicinesText}</p>
            </div>`;
    });
    html += `</div>`;
    container.innerHTML = html;
}

function loadPrescriptionRecordIntoForm(nationalId, index) {
    const rx = patientPrescriptions[nationalId][index];
    if (!rx) return;

    currentEditingPrescription = { nationalId, index };

    document.getElementById('rxCardSearch').value = nationalId;
    fetchPatientByNationalId(nationalId, 'rx');
    switchTab('prescription-tab', document.querySelectorAll('.sidebar-menu li')[1]);

    document.getElementById('rxDate').value = rx.date || '';
    document.getElementById('rxDoctor').value = rx.doctor || '';

    const rows = document.querySelectorAll('#rxTableBody tr');
    rows.forEach((row) => {
        const inputs = row.querySelectorAll('input');
        inputs.forEach(input => input.value = '');
    });

    rx.medicines.forEach((med, i) => {
        const row = rows[i];
        if (!row) return;
        const inputs = row.querySelectorAll('input');

        if (typeof med === 'object' && med !== null) {
            inputs[0].value = med.name || '';
            inputs[1].value = med.qty || '';
            inputs[2].value = med.localPt || '';
            inputs[3].value = med.localEgp || '';
            inputs[4].value = med.impPt || '';
            inputs[5].value = med.impEgp || '';
            inputs[6].value = med.totalPt || '';
            inputs[7].value = med.totalEgp || '';
            inputs[8].value = med.qtrPt || '';
            inputs[9].value = med.qtrEgp || '';
            inputs[10].value = med.devPt || '';
            inputs[11].value = med.devEgp || '';
        } else {
            const medicineMatch = med.match(/دواء \((\d+)\):\s*(.*?)\s*-\s*الكمية:\s*(.*)$/i);
            if (medicineMatch) {
                inputs[0].value = medicineMatch[2].trim();
                inputs[1].value = medicineMatch[3].trim();
            } else {
                inputs[0].value = med;
                inputs[1].value = '1';
            }
        }
    });
}

function printPrescriptionRecord(nationalId, index) {
    loadPrescriptionRecordIntoForm(nationalId, index);
    printPrescriptionSheet();
}

async function deletePrescriptionRecord(nationalId, index) {
    if (confirm('هل أنت متأكد من حذف هذه الروشتة من سجل المريض؟')) {
        const rx = patientPrescriptions[nationalId][index];
        if (!rx || !rx.remoteId) { alert('لا يمكن حذف السجل لأنه غير مرتبط بقاعدة البيانات.'); return; }
        try {
            await deletePrescriptionFromRemote(rx.remoteId);
            await refreshPatientRecords(nationalId);
            saveToStorage();
            renderPatientPrescriptionsHistory(nationalId);
            renderDashboard();
        } catch (err) {
            alert(`تعذر حذف الروشتة من قاعدة البيانات: ${err.message}`);
        }
    }
}

function renderPatientLabsHistory(nationalId) {
    const container = document.getElementById('patientLabsHistory');
    const labs = patientLabs[nationalId] || [];

    if (labs.length === 0) {
        container.innerHTML = `<p style="color: #64748b;">لا توجد طلبات أشعة أو تحاليل مسجلة لهذا المريض حتى الآن.</p>`;
        return;
    }

    let html = `<div style="display: flex; flex-direction: column; gap: 10px;">`;
    labs.forEach((lab, idx) => {
        html += `
            <div style="background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #cbd5e1;">
                <p><b>طلب بتاريخ:</b> ${lab.date}
                   <span style="float: left; display: inline-flex; gap: 5px; flex-wrap: wrap;">
                       <button class="btn btn-primary" style="padding:2px 6px; font-size:11px;" onclick="loadLabRecordIntoForm('${nationalId}', ${idx})">تعديل/عرض</button>
                       <button class="btn btn-warning" style="padding:2px 6px; font-size:11px;" onclick="printLabRecord('${nationalId}', ${idx})">طباعة</button>
                       <button class="btn btn-danger" style="padding:2px 6px; font-size:11px;" onclick="deleteLabRecord('${nationalId}', ${idx})">حذف</button>
                   </span>
                </p>
                <p style="font-size: 14px; color: #334155; margin-top: 5px;"><b>الفحوصات:</b> ${lab.details}</p>
            </div>`;
    });
    html += `</div>`;
    container.innerHTML = html;
}

function loadLabRecordIntoForm(nationalId, index) {
    currentEditingLab = { nationalId, index };
    document.getElementById('labCardSearch').value = nationalId;
    fetchPatientByNationalId(nationalId, 'lab');
    switchTab('lab-tab', document.querySelectorAll('.sidebar-menu li')[2]);

    const labList = patientLabs[nationalId] || [];
    const lab = labList[index];
    if (!lab) return;

    const labRows = document.querySelectorAll('.lab-list-item');
    labRows.forEach((row) => {
        row.querySelector('.lab-desc-input').value = '';
        row.querySelector('.lab-val-input').value = '';
    });

    const items = lab.details.split(' | ');
    items.forEach((itemStr, i) => {
        const row = labRows[i];
        if (!row) return;
        const match = itemStr.match(/فحص \((\d+)\):\s*(.*?)\s*-\s*القيمة:\s*(.*)$/i);
        if (match) {
            row.querySelector('.lab-desc-input').value = match[2].trim();
            row.querySelector('.lab-val-input').value = match[3].trim().replace('غير محدد', '');
        }
    });
}

function printLabRecord(nationalId, index) {
    loadLabRecordIntoForm(nationalId, index);
    printLabSheet();
}

function openRxForCurrentPatient() {
    const p = patients.find(item => item.id === currentProfilePatientId);
    if (p) {
        resetPrescriptionForm();
        document.getElementById('rxCardSearch').value = p.nationalId;
        fetchPatientByNationalId(p.nationalId, 'rx');
        switchTab('prescription-tab', document.querySelectorAll('.sidebar-menu li')[1]);
    }
}

function openLabForCurrentPatient() {
    const p = patients.find(item => item.id === currentProfilePatientId);
    if (p) {
        resetLabForm();
        document.getElementById('labCardSearch').value = p.nationalId;
        fetchPatientByNationalId(p.nationalId, 'lab');
        switchTab('lab-tab', document.querySelectorAll('.sidebar-menu li')[2]);
    }
}

async function deleteLabRecord(nationalId, index) {
    if (confirm('هل أنت متأكد من حذف هذا السجل؟')) {
        const lab = patientLabs[nationalId][index];
        if (!lab || !lab.remoteId) { alert('لا يمكن حذف السجل لأنه غير مرتبط بقاعدة البيانات.'); return; }
        try {
            await deleteLabFromRemote(lab.remoteId);
            await refreshPatientRecords(nationalId);
            saveToStorage();
            renderPatientLabsHistory(nationalId);
            renderDashboard();
        } catch (err) {
            alert(`تعذر حذف طلب الفحص من قاعدة البيانات: ${err.message}`);
        }
    }
}

function normalizeArabicDigits(str) {
    return String(str || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).trim();
}

const searchInput = document.getElementById('patientSearchInput');
if (searchInput) {
    const handleSearch = function () {
        const rawFilter = searchInput.value.trim().toLowerCase();
        const normalizedFilter = normalizeArabicDigits(rawFilter);

        if (normalizedFilter === '') {
            renderPatientsTable(patients);
            return;
        }

        const filtered = patients.filter(p => {
            const medId = normalizeArabicDigits(p.nationalId);
            const idCard = normalizeArabicDigits(p.idCard);
            const name = String(p.name || '').toLowerCase();
            const doctor = String(p.doctorName || '').toLowerCase();
            return medId.includes(normalizedFilter) ||
                   idCard.includes(normalizedFilter) ||
                   name.includes(rawFilter) ||
                   doctor.includes(rawFilter);
        });

        renderPatientsTable(filtered);
    };

    searchInput.addEventListener('input', handleSearch);
    searchInput.addEventListener('keyup', handleSearch);
}

function renderStatCard(title, value, iconPath, theme) {
    return `
    <div class="stat-card">
        <div class="stat-header">
            <span class="stat-title">${title}</span>
            <div class="stat-icon ${theme}">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPath}"></path>
                </svg>
            </div>
        </div>
        <div class="stat-value">${value}</div>
    </div>
    `;
}

function renderDashboard() {
    const dashboardContainer = document.getElementById('dashboard-stats');
    const jobSelect = document.getElementById('pJob');
    if (jobSelect && jobSelect.options.length === 0) {
        fillJobOptions();
    }

    const totalPatientsCount = patients.length;
    const validNationalIds = patients.map(p => p.nationalId);

    let allRx = [];
    for (let nid in patientPrescriptions) {
        if (validNationalIds.includes(nid)) {
            allRx = allRx.concat(patientPrescriptions[nid]);
        }
    }

    let allLabs = [];
    for (let nid in patientLabs) {
        if (validNationalIds.includes(nid)) {
            allLabs = allLabs.concat(patientLabs[nid]);
        }
    }

    const totalVisitsCount = allRx.length + allLabs.length;

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const todayStr = `${dd} / ${mm} / ${yyyy}`;
    const currentMonthYear = `${mm} / ${yyyy}`;

    const todayRxCount = allRx.filter(rx => rx.date && rx.date.replace(/\s+/g, '') === todayStr.replace(/\s+/g, '')).length;
    const todayLabsCount = allLabs.filter(lab => lab.date && lab.date.replace(/\s+/g, '') === todayStr.replace(/\s+/g, '')).length;
    const todayVisitsCount = todayRxCount + todayLabsCount;

    const monthRxCount = allRx.filter(rx => rx.date && rx.date.replace(/\s+/g, '').includes(currentMonthYear.replace(/\s+/g, ''))).length;
    const monthLabsCount = allLabs.filter(lab => lab.date && lab.date.replace(/\s+/g, '').includes(currentMonthYear.replace(/\s+/g, ''))).length;
    const monthVisitsCount = monthRxCount + monthLabsCount;

    if (dashboardContainer) {
        dashboardContainer.innerHTML = `
            <div class="stats-grid">
                ${renderStatCard('إجمالي المرضى', totalPatientsCount, 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', 'primary')}
                ${renderStatCard('إجمالي الزيارات', totalVisitsCount, 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', 'accent')}
                ${renderStatCard('زيارات اليوم', todayVisitsCount, 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', 'primary')}
                ${renderStatCard('زيارات الشهر', monthVisitsCount, 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', 'accent')}
            </div>
        `;
    }
}


// ==================== MongoDB Data Layer (uses the second project's DB only) ====================
// Keep the first project's UI and interaction model; only replace the persistence layer.
const API_BASE_URL = window.CLINIC_API_BASE_URL || '';
let mongoOnline = false;

function getApiUrl(path) {
    return `${API_BASE_URL}${path}`;
}

async function safeFetchJson(url, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Cache-Control', 'no-store');
    const token = typeof window.clinicAuthToken === 'function' ? window.clinicAuthToken() : '';
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const controller = new AbortController();
    const timeoutMs = Number(options.timeoutMs || 20000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, { ...options, headers, cache: 'no-store', signal: options.signal || controller.signal });
        const text = await response.text();
        let json = {};
        try { json = text ? JSON.parse(text) : {}; } catch (_) {
            throw new Error(`استجابة غير صالحة من الخادم (${response.status})`);
        }
        if (response.status === 401) {
            if (typeof window.clinicLogout === 'function') window.clinicLogout();
            throw new Error('انتهت جلسة الدخول. سجل الدخول مرة أخرى.');
        }
        if (!response.ok || json.success === false) {
            throw new Error(json.message || `فشل الطلب (${response.status})`);
        }
        return json;
    } catch (error) {
        if (error?.name === 'AbortError') {
            mongoOnline = false;
            throw new Error('انتهت مهلة الاتصال بالخادم. تأكد من اتصال MongoDB ثم حاول مرة أخرى.');
        }
        if (error instanceof TypeError || /Failed to fetch/i.test(String(error?.message || ''))) {
            mongoOnline = false;
            throw new Error('تعذر الاتصال بالخادم. تأكد أن الموقع والخادم وقاعدة MongoDB يعملون بشكل صحيح.');
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

function isRemoteEnabled() { return mongoOnline; }
function getRemoteStatusText() { return mongoOnline ? 'تم الاتصال بقاعدة البيانات بنجاح.' : 'قاعدة البيانات غير متاحة حالياً.'; }
function toIsoDate(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const m = text.match(/^(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4})$/);
    return m ? `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}` : null;
}
function fromIsoDate(value) {
    const text = String(value || '').trim();
    const m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]} / ${m[2]} / ${m[1]}` : text;
}

async function testMongoConnection() {
    try {
        await safeFetchJson(getApiUrl('/api/health'));
        mongoOnline = true;
        return { ok: true, message: 'MongoDB متصل' };
    } catch (e) {
        mongoOnline = false;
        return { ok: false, message: e.message || 'تعذر الاتصال' };
    }
}

async function fetchRemoteJobOptions() {
    try {
        const json = await safeFetchJson(getApiUrl('/api/jobs'));
        return Array.isArray(json.data) ? json.data.map(x => x.name || x).filter(Boolean) : [];
    } catch (e) {
        console.error('Mongo jobs load failed:', e);
        return [];
    }
}
async function saveRemoteJobOption(name) {
    try { await safeFetchJson(getApiUrl('/api/jobs'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name}) }); }
    catch (e) { console.error('Mongo job save failed:', e); throw e; }
}
async function loadJobOptions() {
    const remote = await fetchRemoteJobOptions();
    jobOptions = remote.length ? remote : (JSON.parse(localStorage.getItem('clinic_job_options')) || []);
    localStorage.setItem('clinic_job_options', JSON.stringify(jobOptions));
}

async function refreshPatientRecords(nationalId) {
    const patient = patients.find(p => p.nationalId === nationalId);
    if (!patient) return;
    const targetId = patient.remoteId || patient.nationalId;
    const [rxJson, labJson] = await Promise.all([
        safeFetchJson(getApiUrl(`/api/prescriptions/patient/${encodeURIComponent(targetId)}`)),
        safeFetchJson(getApiUrl(`/api/labs/patient/${encodeURIComponent(targetId)}`))
    ]);
    patientPrescriptions[nationalId] = (rxJson.data || []).map(rx => ({
        remoteId: rx._id,
        nationalId,
        date: fromIsoDate(rx.prescriptionDate) || '',
        doctor: rx.doctor || 'غير محدد',
        medicines: rx.medicines || []
    }));
    patientLabs[nationalId] = (labJson.data || []).map(lab => ({
        remoteId: lab._id,
        nationalId,
        date: fromIsoDate(lab.requestDate) || '',
        details: Array.isArray(lab.items) && lab.items.length
            ? lab.items.map((it, i) => `فحص (${i + 1}): ${it.description} - القيمة: ${it.value || 'غير محدد'}`).join(' | ')
            : (lab.notes || '')
    }));
}

async function initializeRemoteData() {
    if (remoteRefreshInFlight) return;
    remoteRefreshInFlight = true;
    try {
        const [patientsJson, rxJson, labJson] = await Promise.all([
            safeFetchJson(getApiUrl('/api/patients?limit=all')),
            safeFetchJson(getApiUrl('/api/prescriptions')),
            safeFetchJson(getApiUrl('/api/labs'))
        ]);

        patients = (patientsJson.data || []).map(p => ({
            id: p._id, remoteId: p._id, nationalId: p.medicalId || '',
            idCard: p.nationalId || '', name:p.name, system:p.system||'',
            job:p.job||'', doctorName:p.doctorName||'', image:p.imageUrl||''
        }));

        patientPrescriptions = {};
        (rxJson.data || []).forEach(rx => {
            const pat = rx.patientId; if (!pat) return;
            const nationalId = pat.medicalId || pat.nationalId; if (!nationalId) return;
            (patientPrescriptions[nationalId] ||= []).push({
                remoteId: rx._id, nationalId, date: fromIsoDate(rx.prescriptionDate)||'',
                doctor: rx.doctor || 'غير محدد', medicines: rx.medicines || []
            });
        });

        patientLabs = {};
        (labJson.data || []).forEach(lab => {
            const pat = lab.patientId; if (!pat) return;
            const nationalId = pat.medicalId || pat.nationalId; if (!nationalId) return;
            let details = lab.notes || '';
            if (Array.isArray(lab.items) && lab.items.length) {
                details = lab.items.map((it, i) => `فحص (${i+1}): ${it.description} - القيمة: ${it.value || 'غير محدد'}`).join(' | ');
            }
            (patientLabs[nationalId] ||= []).push({
                remoteId: lab._id, nationalId, date: fromIsoDate(lab.requestDate)||'', details
            });
        });
        saveToStorage();
        mongoOnline = true;
    } catch (e) {
        mongoOnline = false;
        console.error('Mongo initialization failed:', e);
        throw e;
    } finally {
        remoteRefreshInFlight = false;
    }
}

async function refreshPatientsOnly() {
    if (remoteRefreshInFlight) return;
    remoteRefreshInFlight = true;
    try {
        const json = await safeFetchJson(getApiUrl('/api/patients?limit=all'));
        patients = (json.data || []).map(p => ({
            id: p._id, remoteId: p._id, nationalId: p.medicalId || '',
            idCard: p.nationalId || '', name: p.name, system: p.system || '',
            job: p.job || '', doctorName: p.doctorName || '', image: p.imageUrl || ''
        }));
        saveToStorage();
        mongoOnline = true;
    } catch (e) {
        mongoOnline = false;
        console.warn('Patients refresh skipped:', e.message || e);
    } finally {
        remoteRefreshInFlight = false;
    }
}

async function savePatientToRemote(patient) {
    const payload = {
        medicalId: patient.nationalId,
        nationalId: patient.idCard || patient.nationalId,
        name: patient.name, system: patient.system || '', job: patient.job || '',
        doctorName: patient.doctorName || '', imageUrl: patient.image || ''
    };
    const url = patient.remoteId ? getApiUrl(`/api/patients/${patient.remoteId}`) : getApiUrl('/api/patients');
    const method = patient.remoteId ? 'PATCH' : 'POST';
    const json = await safeFetchJson(url, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    return json.data || null;
}
async function deletePatientFromRemote(remoteId) {
    if (!remoteId) return;
    await safeFetchJson(getApiUrl(`/api/patients/${remoteId}`), { method:'DELETE' });
}
async function savePrescriptionToRemote(patientRemoteId, rxData, prescriptionRemoteId=null) {
    const payload = { prescriptionDate: toIsoDate(rxData.date)||new Date(), doctor:rxData.doctor||'غير محدد', medicines:rxData.medicines||[] };
    const url = prescriptionRemoteId ? getApiUrl(`/api/prescriptions/${prescriptionRemoteId}`) : getApiUrl(`/api/prescriptions/patient/${patientRemoteId}`);
    const method = prescriptionRemoteId ? 'PATCH' : 'POST';
    const json = await safeFetchJson(url, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    return json.data?._id || null;
}
async function deletePrescriptionFromRemote(remoteId) {
    if (remoteId) await safeFetchJson(getApiUrl(`/api/prescriptions/${remoteId}`), {method:'DELETE'});
}
async function saveLabToRemote(patientRemoteId, labData, labRemoteId=null) {
    const items = [];
    String(labData.details||'').split(' | ').filter(Boolean).forEach(part => {
        const m = part.match(/فحص \(\d+\):\s*(.*?)\s*-\s*القيمة:\s*(.*)$/i);
        items.push(m ? {description:m[1].trim(), value:m[2].trim()==='غير محدد'?'':m[2].trim()} : {description:part, value:''});
    });
    const payload = { requestDate:toIsoDate(labData.date)||new Date(), items:items.length?items:[{description:'طلب فحص/تحليل',value:''}], notes:labData.details||'' };
    const url = labRemoteId ? getApiUrl(`/api/labs/${labRemoteId}`) : getApiUrl(`/api/labs/patient/${patientRemoteId}`);
    const method = labRemoteId ? 'PATCH' : 'POST';
    const json = await safeFetchJson(url, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    return json.data?._id || null;
}
async function deleteLabFromRemote(remoteId) {
    if (remoteId) await safeFetchJson(getApiUrl(`/api/labs/${remoteId}`), {method:'DELETE'});
}

// تشغيل الدوال الأساسية عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async () => {
    if (window.clinicAuthReady) {
        const authenticated = await window.clinicAuthReady;
        if (!authenticated) return;
    }
    await loadMedicinesCatalog();
    generateRxTableRows();
    setCurrentDate();

    const connection = await testMongoConnection();
    if (connection.ok) {
        try { await initializeRemoteData(); }
        catch (error) { console.error('MongoDB initialization failed:', error); }
    } else {
        console.warn('قاعدة البيانات غير متاحة حالياً:', connection.message);
    }

    await loadJobOptions();
    fillJobOptions();
    renderPatientsTable();
    updatePatientsViewButton();
    const togglePatientsButton = document.getElementById('togglePatientsViewBtn');
    if (togglePatientsButton) {
        togglePatientsButton.addEventListener('click', togglePatientsView);
    }
    renderDashboard();

    // مزامنة مركزية: أي جهاز يحفظ البيانات تظهر على الأجهزة الأخرى خلال ثوانٍ.
    const refreshAllDevices = async () => {
        if (!isRemoteEnabled() || document.visibilityState !== 'visible' || remoteRefreshInFlight) return;
        try {
            await initializeRemoteData();
            const searchInput = document.getElementById('patientSearchInput');
            if (searchInput && searchInput.value.trim() !== '') searchInput.dispatchEvent(new Event('input'));
            else renderPatientsTable(patients);
            renderDashboard();
            updatePatientsViewButton();
            // مهم: لا نفتح صفحة المريض تلقائيًا أثناء التحديث المركزي.
            // التحديث التلقائي يجب أن يحدّث الصفحة الحالية فقط، ولا يغيّر الـTab الذي اختاره المستخدم.
            const activeTabId = document.querySelector('.tab-content.active')?.id || '';
            if (activeTabId === 'patient-profile-tab' && currentProfilePatientId) {
                const current = patients.find(p => p.id === currentProfilePatientId);
                if (current) {
                    await refreshPatientRecords(current.nationalId);
                    viewPatientProfile(current.id);
                }
            }
        } catch (e) {
            console.warn('Central refresh skipped:', e.message || e);
        }
    };

    setInterval(refreshAllDevices, 15000);
    window.addEventListener('focus', refreshAllDevices);
});