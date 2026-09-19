const { createClient } = supabase;
const sb = createClient(window.MOHIT_CONFIG.SUPABASE_URL, window.MOHIT_CONFIG.SUPABASE_PUBLISHABLE_KEY);

const form = document.getElementById("studentForm");
const notice = document.getElementById("authNotice");
const msg = document.getElementById("msg");
const courseSelect = document.getElementById("course_id");
const emailInput = document.getElementById("email");

function showMsg(text, error=false){
  msg.textContent=text;
  msg.className=error ? "notice error" : "notice";
}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}

async function uploadPrivateFile(userId, file, kind){
  if(!file) throw new Error("Please select "+kind+" file.");
  const allowed = ["image/jpeg","image/png","image/webp","application/pdf"];
  if(!allowed.includes(file.type)) throw new Error("Unsupported "+kind+" file type.");
  if(file.size > 5 * 1024 * 1024) throw new Error(kind+" file must be 5 MB or smaller.");
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g,"");
  const path = `${userId}/${kind}-${crypto.randomUUID()}.${ext}`;
  const {error}=await sb.storage.from("student-private").upload(path,file,{upsert:false,contentType:file.type});
  if(error) throw error;
  return path;
}

async function load(){
  const {data:{user}}=await sb.auth.getUser();
  if(!user){
    notice.innerHTML='Login/Signup is required before registration. <a href="login.html?next=student-registration.html">Login</a> or <a href="signup.html">Create Account</a>.';
    return;
  }
  notice.textContent="Logged in as "+user.email;
  form.style.display="";
  emailInput.value=user.email||"";

  const {data:courses,error}=await sb.from("courses").select("id,code,name,duration_months,fee_inr").eq("active",true).order("name");
  if(error){ showMsg("Courses could not be loaded: "+error.message,true); return; }
  courseSelect.innerHTML='<option value="">Select a course</option>'+(courses||[]).map(c=>`<option value="${esc(c.id)}">${esc(c.code)} — ${esc(c.name)} — ₹${Number(c.fee_inr||0).toLocaleString("en-IN")}</option>`).join("");

  const qs=new URLSearchParams(location.search);
  const requested=qs.get("course");
  if(requested){
    const match=(courses||[]).find(c=>c.id===requested || c.code===requested);
    if(match) courseSelect.value=match.id;
  }
}

form.addEventListener("submit", async e=>{
  e.preventDefault();
  showMsg("Submitting registration…");
  const btn=document.getElementById("submitBtn");
  btn.disabled=true;

  try{
    const {data:{user}}=await sb.auth.getUser();
    if(!user) throw new Error("Please login first.");

    const aadhaar=document.getElementById("aadhaar_number").value.replace(/\D/g,"");
    if(aadhaar.length!==12) throw new Error("Aadhaar Number must contain 12 digits.");

    const mobile=document.getElementById("mobile").value.trim();
    if(mobile.length<10) throw new Error("Please enter a valid mobile number.");

    const courseId=courseSelect.value;
    if(!courseId) throw new Error("Please select a course.");

    // Store files in the private bucket before creating the student record.
    const photoPath=await uploadPrivateFile(user.id,document.getElementById("photo").files[0],"photo");
    const documentPath=await uploadPrivateFile(user.id,document.getElementById("document").files[0],"document");

    const studentPayload={
      auth_user_id:user.id,
      full_name:document.getElementById("full_name").value.trim(),
      father_name:document.getElementById("father_name").value.trim()||null,
      mother_name:document.getElementById("mother_name").value.trim()||null,
      gender:document.getElementById("gender").value||null,
      date_of_birth:document.getElementById("date_of_birth").value||null,
      mobile,
      email:user.email,
      qualification:document.getElementById("qualification").value.trim()||null,
      address:document.getElementById("address").value.trim()||null,
      state:document.getElementById("state").value.trim()||null,
      district:document.getElementById("district").value.trim()||null,
      pin_code:document.getElementById("pin_code").value.trim()||null
    };

    const {data:student,error:sErr}=await sb.from("students").insert(studentPayload).select("id").single();
    if(sErr) throw sErr;

    const {error:privateErr}=await sb.from("student_sensitive").insert({
      student_id:student.id,
      aadhaar_number:aadhaar,
      photo_path:photoPath,
      document_path:documentPath
    });
    if(privateErr) throw privateErr;

    const {data:enrollment,error:eErr}=await sb.from("enrollments").insert({
      student_id:student.id,
      course_id:courseId,
      status:"pending_payment"
    }).select("id").single();
    if(eErr) throw eErr;

    showMsg("Registration submitted successfully. Your application is now pending payment/admin review.");
    form.reset();
    emailInput.value=user.email||"";
  }catch(err){
    console.error(err);
    showMsg(err.message||"Registration failed. Please try again.",true);
  }finally{
    btn.disabled=false;
  }
});

document.getElementById("logout").onclick=async()=>{await sb.auth.signOut();location.href="index.html";};
load();
