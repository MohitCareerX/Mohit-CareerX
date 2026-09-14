const { createClient } = supabase;
const sb = createClient(window.MOHIT_CONFIG.SUPABASE_URL, window.MOHIT_CONFIG.SUPABASE_PUBLISHABLE_KEY);

function configOK(){
  return window.MOHIT_CONFIG.SUPABASE_URL.startsWith("http") &&
    !window.MOHIT_CONFIG.SUPABASE_PUBLISHABLE_KEY.startsWith("YOUR_");
}
function show(id,msg,err=false){const el=document.getElementById(id); if(!el)return; el.textContent=msg; el.className=err?"notice error":"notice";}
async function signup(){
  const name=document.getElementById("name").value.trim(), email=document.getElementById("email").value.trim(), password=document.getElementById("password").value;
  if(!configOK()) return show("msg","First add your Supabase URL and publishable key in supabase-config.js.",true);
  if(password.length<6) return show("msg","Use a password with at least 6 characters.",true);
  const {data,error}=await sb.auth.signUp({email,password,options:{data:{full_name:name}}});
  if(error)return show("msg",error.message,true);
  show("msg",data.session?"Account created. Redirecting…":"Account created. Check your email to verify your account.");
  if(data.session) setTimeout(()=>location.href="dashboard.html",600);
}
async function login(){
  const email=document.getElementById("email").value.trim(), password=document.getElementById("password").value;
  if(!configOK()) return show("msg","First add your Supabase URL and publishable key in supabase-config.js.",true);
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  if(error)return show("msg",error.message,true);
  const next = new URLSearchParams(location.search).get("next");
  location.href = next === "admin.html" ? "admin.html" : "dashboard.html";
}
async function logout(){await sb.auth.signOut();location.href="index.html";}
