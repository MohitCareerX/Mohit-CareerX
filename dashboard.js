const {createClient}=supabase;const sb=createClient(window.MOHIT_CONFIG.SUPABASE_URL,window.MOHIT_CONFIG.SUPABASE_PUBLISHABLE_KEY);
async function init(){
 const {data:{user}}=await sb.auth.getUser(); if(!user){location.href="login.html";return;}
 document.getElementById("email").textContent=user.email;
 const {data:p}=await sb.from("profiles").select("*").eq("id",user.id).maybeSingle();
 document.getElementById("welcome").textContent=`Hello, ${p?.full_name||"Career Explorer"} 👋`;
 const {data:apps,error:aerr}=await sb.from("applications").select("id,status,created_at,jobs(title,company,location)").order("created_at",{ascending:false});
 document.getElementById("apps").innerHTML=apps?.length?apps.map(a=>`<article class="card"><span class="badge">${a.status}</span><h3>${a.jobs?.title||"Job"}</h3><p class="muted">${a.jobs?.company||""} · ${a.jobs?.location||""}</p><small class="muted">${new Date(a.created_at).toLocaleDateString()}</small></article>`).join(""):`<div class="card">No applications yet. <a href="index.html#jobs" style="color:#ffd21c">Browse jobs →</a></div>`;
 const {data:saved}=await sb.from("saved_jobs").select("created_at,jobs(id,title,company,location,job_type)").order("created_at",{ascending:false});
 document.getElementById("saved").innerHTML=saved?.length?saved.map(s=>`<article class="card"><span class="badge">${s.jobs?.job_type||"Job"}</span><h3>${s.jobs?.title||""}</h3><p class="muted">${s.jobs?.company||""} · ${s.jobs?.location||""}</p></article>`).join(""):`<div class="card">No saved jobs yet.</div>`;
}
document.getElementById("logout").onclick=async()=>{await sb.auth.signOut();location.href="index.html"};init();
