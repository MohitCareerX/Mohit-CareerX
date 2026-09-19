// ============================================================
// MOHIT CAREERX
// ADMIN PANEL V3
// Jobs + Courses + Students + Payments + Certificates
// ============================================================

const { createClient } = supabase;

const sb = createClient(
  window.MOHIT_CONFIG.SUPABASE_URL,
  window.MOHIT_CONFIG.SUPABASE_PUBLISHABLE_KEY
);

let jobs = [];
let courses = [];
let students = [];
let payments = [];
let certificates = [];
let enrollments = [];

const $ = id => document.getElementById(id);


// ============================================================
// HELPERS
// ============================================================

const esc = value =>
  String(value ?? "").replace(
    /[&<>"']/g,
    m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m])
  );


function note(id, text, error = false) {

  const el = $(id);

  if (!el) return;

  el.textContent = text;

  el.className = error
    ? "notice error"
    : "notice";
}


function setStatus(text, error = false) {

  note(
    "status",
    text,
    error
  );

}


function money(value) {

  const number = Number(value || 0);

  return "₹" + number.toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 2
    }
  );

}


function formatDate(value) {

  if (!value) return "-";

  try {

    return new Date(value).toLocaleDateString(
      "en-IN"
    );

  } catch {

    return value;

  }

}


// ============================================================
// ADMIN GUARD
// ============================================================

async function guard() {

  try {

    if (
      !window.MOHIT_CONFIG?.SUPABASE_URL ||
      !window.MOHIT_CONFIG?.SUPABASE_PUBLISHABLE_KEY
    ) {

      throw new Error(
        "Supabase configuration is missing."
      );

    }


    const {
      data: sessionData,
      error: sessionError
    } = await sb.auth.getSession();


    if (sessionError)
      throw sessionError;


    if (!sessionData?.session?.user) {

      setStatus(
        "Please login first. Redirecting to Login…",
        true
      );

      setTimeout(() => {

        location.href =
          "login.html?next=admin.html";

      }, 700);

      return;

    }


    const {
      data: userData,
      error: userError
    } = await sb.auth.getUser();


    if (userError)
      throw userError;


    const user = userData?.user;


    if (!user)
      throw new Error(
        "Login session expired."
      );


    const {
      data: profile,
      error: profileError
    } = await sb
      .from("profiles")
      .select("role,full_name")
      .eq("id", user.id)
      .maybeSingle();


    if (profileError)
      throw profileError;


    if (profile?.role !== "admin") {

      setStatus(
        "Access denied. Your account is not an admin.",
        true
      );

      return;

    }


    setStatus(
      `Admin access granted${
        profile.full_name
          ? " — " + profile.full_name
          : ""
      }.`
    );


    $("adminArea").style.display =
      "block";


    await Promise.all([
      loadJobs(),
      loadCourses(),
      loadStudents(),
      loadPayments(),
      loadEnrollments(),
      loadCertificates()
    ]);


  } catch (error) {

    console.error(error);

    setStatus(
      "Admin check failed: " +
      (error.message || error),
      true
    );

  }

}


// ============================================================
// JOBS
// ============================================================

async function loadJobs() {

  const {
    data,
    error
  } = await sb
    .from("jobs")
    .select("*")
    .order(
      "created_at",
      {
        ascending: false
      }
    );


  if (error) {

    note(
      "msg",
      error.message,
      true
    );

    return;

  }


  jobs = data || [];


  $("count").textContent =
    jobs.length + " listings";


  $("rows").innerHTML =
    jobs.length
      ? jobs.map(job => `

        <tr>

          <td>
            ${esc(job.title)}
          </td>

          <td>
            ${esc(job.company)}
          </td>

          <td>
            ${esc(job.category)}
          </td>

          <td>
            ${
              job.is_active
                ? "🟢 Active"
                : "⚪ Hidden"
            }
          </td>

          <td>

            <button
              class="btn small ghost"
              onclick="editJob('${job.id}')"
            >
              Edit
            </button>

            <button
              class="btn small ghost"
              onclick="delJob('${job.id}')"
            >
              Delete
            </button>

          </td>

        </tr>

      `).join("")

      : `
        <tr>
          <td colspan="5">
            No jobs yet.
          </td>
        </tr>
      `;

}


function resetJob() {

  $("jobForm").reset();

  $("jobId").value = "";

  $("formTitle").textContent =
    "Add Job";

  $("is_active").checked =
    true;

}


window.editJob = id => {

  const job =
    jobs.find(
      item => item.id === id
    );

  if (!job) return;


  [
    "title",
    "company",
    "location",
    "category",
    "job_type",
    "experience",
    "salary",
    "skills",
    "description",
    "apply_url"
  ].forEach(key => {

    $(key).value =
      job[key] || "";

  });


  $("jobId").value =
    id;

  $("is_remote").checked =
    !!job.is_remote;

  $("is_active").checked =
    !!job.is_active;

  $("formTitle").textContent =
    "Edit Job";


  showTab("jobsTab");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

};


$("jobForm").onsubmit =
  async event => {

    event.preventDefault();


    try {

      const {
        data: { user }
      } = await sb.auth.getUser();


      if (!user)
        return note(
          "msg",
          "Please login again.",
          true
        );


      const payload = {

        title:
          $("title").value.trim(),

        company:
          $("company").value.trim(),

        location:
          $("location").value.trim(),

        category:
          $("category").value,

        job_type:
          $("job_type").value.trim(),

        experience:
          $("experience").value.trim(),

        salary:
          $("salary").value.trim(),

        skills:
          $("skills").value.trim(),

        description:
          $("description").value.trim(),

        apply_url:
          $("apply_url").value.trim(),

        is_remote:
          $("is_remote").checked,

        is_active:
          $("is_active").checked,

        created_by:
          user.id

      };


      const id =
        $("jobId").value;


      const result =
        id

          ? await sb
              .from("jobs")
              .update(payload)
              .eq("id", id)

          : await sb
              .from("jobs")
              .insert(payload);


      if (result.error)
        throw result.error;


      note(
        "msg",
        "Job saved successfully."
      );


      resetJob();

      await loadJobs();


    } catch (error) {

      note(
        "msg",
        error.message ||
          String(error),
        true
      );

    }

  };


$("reset").onclick =
  resetJob;


window.delJob =
  async id => {

    if (
      !confirm(
        "Delete this job?"
      )
    )
      return;


    const {
      error
    } = await sb
      .from("jobs")
      .delete()
      .eq("id", id);


    if (error)
      return note(
        "msg",
        error.message,
        true
      );


    await loadJobs();

  };


// ============================================================
// COURSES
// ============================================================

async function loadCourses() {

  const {
    data,
    error
  } = await sb
    .from("courses")
    .select("*")
    .order(
      "created_at",
      {
        ascending: false
      }
    );


  if (error) {

    note(
      "courseMsg",
      error.message,
      true
    );

    return;

  }


  courses =
    data || [];


  $("courseCount").textContent =
    courses.length +
    " courses";


  $("courseRows").innerHTML =
    courses.length

      ? courses.map(course => `

        <tr>

          <td>
            ${esc(course.code)}
          </td>

          <td>
            ${esc(course.name)}
          </td>

          <td>
            ${
              course.duration_months
                ? course.duration_months +
                  " months"
                : "-"
            }
          </td>

          <td>
            ${money(course.fee_inr)}
          </td>

          <td>
            ${
              course.active
                ? "🟢 Active"
                : "⚪ Inactive"
            }
          </td>

          <td>

            <button
              class="btn small ghost"
              onclick="editCourse('${course.id}')"
            >
              Edit
            </button>

            <button
              class="btn small ghost"
              onclick="deleteCourse('${course.id}')"
            >
              Delete
            </button>

          </td>

        </tr>

      `).join("")

      : `
        <tr>
          <td colspan="6">
            No courses found.
          </td>
        </tr>
      `;

}


function resetCourse() {

  $("courseForm").reset();

  $("courseId").value =
    "";

  $("courseFormTitle").textContent =
    "Add Course";

  $("courseActive").checked =
    true;

}


window.editCourse =
  id => {

    const course =
      courses.find(
        item => item.id === id
      );

    if (!course) return;


    $("courseId").value =
      course.id;

    $("courseCode").value =
      course.code || "";

    $("courseName").value =
      course.name || "";

    $("courseDescription").value =
      course.description || "";

    $("courseDuration").value =
      course.duration_months ??
      "";

    $("courseFee").value =
      course.fee_inr ?? 0;

    $("courseActive").checked =
      !!course.active;


    $("courseFormTitle").textContent =
      "Edit Course";


    showTab(
      "coursesTab"
    );

  };


$("courseForm").onsubmit =
  async event => {

    event.preventDefault();


    try {

      const {
        data: { user }
      } = await sb.auth.getUser();


      if (!user)
        throw new Error(
          "Please login again."
        );


      const durationValue =
        $("courseDuration").value;


      const payload = {

        code:
          $("courseCode")
            .value
            .trim()
            .toUpperCase(),

        name:
          $("courseName")
            .value
            .trim(),

        description:
          $("courseDescription")
            .value
            .trim(),

        duration_months:
          durationValue
            ? Number(durationValue)
            : null,

        fee_inr:
          Number(
            $("courseFee").value || 0
          ),

        active:
          $("courseActive").checked,

        updated_at:
          new Date().toISOString()

      };


      const id =
        $("courseId").value;


      const result =
        id

          ? await sb
              .from("courses")
              .update(payload)
              .eq("id", id)

          : await sb
              .from("courses")
              .insert(payload);


      if (result.error)
        throw result.error;


      note(
        "courseMsg",
        "Course saved successfully."
      );


      resetCourse();

      await loadCourses();


    } catch (error) {

      note(
        "courseMsg",
        error.message ||
          String(error),
        true
      );

    }

  };


$("courseReset").onclick =
  resetCourse;


window.deleteCourse =
  async id => {

    if (
      !confirm(
        "Delete this course?"
      )
    )
      return;


    const {
      error
    } = await sb
      .from("courses")
      .delete()
      .eq("id", id);


    if (error)
      return note(
        "courseMsg",
        error.message,
        true
      );


    await loadCourses();

  };


// ============================================================
// STUDENTS
// ============================================================

async function loadStudents() {

  const {
    data,
    error
  } = await sb
    .from("students")
    .select(
      `
      id,
      student_code,
      full_name,
      email,
      mobile,
      status,
      created_at
      `
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    );


  if (error) {

    $("studentRows").innerHTML =
      `
      <tr>
        <td colspan="6">
          ${esc(error.message)}
        </td>
      </tr>
      `;

    return;

  }


  students =
    data || [];


  $("studentCount").textContent =
    students.length +
    " students";


  $("studentRows").innerHTML =
    students.length

      ? students.map(student => `

        <tr>

          <td>
            <strong>
              ${esc(student.student_code)}
            </strong>
          </td>

          <td>
            ${esc(student.full_name)}
          </td>

          <td>
            ${esc(student.email)}
          </td>

          <td>
            ${esc(student.mobile)}
          </td>

          <td>

            <select
              class="select"
              onchange="updateStudentStatus(
                '${student.id}',
                this.value
              )"
            >

              <option
                value="pending"
                ${
                  student.status ===
                  "pending"
                    ? "selected"
                    : ""
                }
              >
                Pending
              </option>

              <option
                value="approved"
                ${
                  student.status ===
                  "approved"
                    ? "selected"
                    : ""
                }
              >
                Approved
              </option>

              <option
                value="active"
                ${
                  student.status ===
                  "active"
                    ? "selected"
                    : ""
                }
              >
                Active
              </option>

              <option
                value="completed"
                ${
                  student.status ===
                  "completed"
                    ? "selected"
                    : ""
                }
              >
                Completed
              </option>

              <option
                value="rejected"
                ${
                  student.status ===
                  "rejected"
                    ? "selected"
                    : ""
                }
              >
                Rejected
              </option>

            </select>

          </td>

          <td>
            ${formatDate(
              student.created_at
            )}
          </td>

        </tr>

      `).join("")

      : `
        <tr>
          <td colspan="6">
            No students registered yet.
          </td>
        </tr>
      `;

}


window.updateStudentStatus =
  async (id, status) => {

    try {

      const {
        error
      } = await sb
        .from("students")
        .update({
          status,
          updated_at:
            new Date().toISOString()
        })
        .eq("id", id);


      if (error)
        throw error;


      await loadStudents();


    } catch (error) {

      alert(
        "Student status update failed: " +
        error.message
      );

    }

  };


// ============================================================
// ENROLLMENTS
// ============================================================

async function loadEnrollments() {

  const {
    data,
    error
  } = await sb
    .from("enrollments")
    .select(
      `
      id,
      enrollment_no,
      student_id,
      course_id,
      fee_amount,
      discount_amount,
      payable_amount,
      status,
      start_date,
      completion_date,
      created_at,
      students (
        full_name,
        student_code
      ),
      courses (
        code,
        name
      )
      `
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    );


  if (error) {

    console.error(
      "Enrollment load error:",
      error
    );

    enrollments = [];

    return;

  }


  enrollments =
    data || [];

}


// ============================================================
// PAYMENTS
// ============================================================

async function loadPayments() {

  const {
    data,
    error
  } = await sb
    .from("payments")
    .select(
      `
      id,
      enrollment_id,
      amount,
      status,
      method,
      reference_no,
      paid_at,
      notes,
      created_at,
      enrollments (
        enrollment_no,
        student_id,
        students (
          full_name,
          student_code
        )
      )
      `
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    );


  if (error) {

    $("paymentRows").innerHTML =
      `
      <tr>
        <td colspan="7">
          ${esc(error.message)}
        </td>
      </tr>
      `;

    return;

  }


  payments =
    data || [];


  $("paymentCount").textContent =
    payments.length +
    " payments";


  $("paymentRows").innerHTML =
    payments.length

      ? payments.map(payment => {

          const enrollment =
            payment.enrollments;

          const student =
            enrollment?.students;


          return `

          <tr>

            <td>
              ${esc(
                student?.full_name ||
                "-"
              )}
            </td>

            <td>
              ${esc(
                enrollment?.enrollment_no ||
                "-"
              )}
            </td>

            <td>
              ${money(
                payment.amount
              )}
            </td>

            <td>
              ${esc(
                payment.method ||
                "-"
              )}
            </td>

            <td>
              ${esc(
                payment.reference_no ||
                "-"
              )}
            </td>

            <td>

              <select
                class="select"
                onchange="
                  updatePaymentStatus(
                    '${payment.id}',
                    this.value,
                    '${payment.enrollment_id}'
                  )
                "
              >

                <option
                  value="pending"
                  ${
                    payment.status ===
                    "pending"
                      ? "selected"
                      : ""
                  }
                >
                  Pending
                </option>

                <option
                  value="paid"
                  ${
                    payment.status ===
                    "paid"
                      ? "selected"
                      : ""
                  }
                >
                  Paid
                </option>

                <option
                  value="failed"
                  ${
                    payment.status ===
                    "failed"
                      ? "selected"
                      : ""
                  }
                >
                  Failed
                </option>

                <option
                  value="refunded"
                  ${
                    payment.status ===
                    "refunded"
                      ? "selected"
                      : ""
                  }
                >
                  Refunded
                </option>

              </select>

            </td>

            <td>
              ${formatDate(
                payment.paid_at
              )}
            </td>

          </tr>

          `;

        }).join("")

      : `
        <tr>
          <td colspan="7">
            No payment records found.
          </td>
        </tr>
      `;

}


window.updatePaymentStatus =
  async (
    paymentId,
    status,
    enrollmentId
  ) => {

    try {

      const updateData = {
        status
      };


      if (
        status === "paid"
      ) {

        updateData.paid_at =
          new Date().toISOString();

      }


      const {
        error
      } = await sb
        .from("payments")
        .update(updateData)
        .eq("id", paymentId);


      if (error)
        throw error;


      // Payment paid => enrollment becomes enrolled
      if (
        status === "paid"
      ) {

        const {
          error:
            enrollmentError
        } = await sb
          .from("enrollments")
          .update({
            status: "enrolled",
            updated_at:
              new Date().toISOString()
          })
          .eq(
            "id",
            enrollmentId
          );


        if (enrollmentError)
          throw enrollmentError;

      }


      await loadPayments();

      await loadEnrollments();


    } catch (error) {

      alert(
        "Payment update failed: " +
        error.message
      );

      await loadPayments();

    }

  };


// ============================================================
// CERTIFICATES
// ============================================================

async function loadCertificates() {

  const {
    data,
    error
  } = await sb
    .from("certificates")
    .select(
      `
      id,
      enrollment_id,
      certificate_no,
      issue_date,
      status,
      created_at,
      enrollments (
        enrollment_no,
        student_id,
        course_id,
        students (
          full_name,
          student_code
        ),
        courses (
          code,
          name
        )
      )
      `
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    );


  if (error) {

    note(
      "certificateMsg",
      error.message,
      true
    );

    return;

  }


  certificates =
    data || [];


  $("certificateCount").textContent =
    certificates.length +
    " certificates";


  $("certificateRows").innerHTML =
    certificates.length

      ? certificates.map(cert => {

          const enrollment =
            cert.enrollments;

          const student =
            enrollment?.students;

          const course =
            enrollment?.courses;


          return `

          <tr>

            <td>
              <strong>
                ${esc(
                  cert.certificate_no
                )}
              </strong>
            </td>

            <td>
              ${esc(
                student?.full_name ||
                "-"
              )}
            </td>

            <td>
              ${esc(
                course?.name ||
                "-"
              )}
            </td>

            <td>
              ${formatDate(
                cert.issue_date
              )}
            </td>

            <td>
              ${
                cert.status ===
                "issued"
                  ? "🟢 Issued"
                  : "⚪ " +
                    esc(
                      cert.status
                    )
              }
            </td>

            <td>

              ${
                cert.status ===
                "issued"

                  ? `
                    <button
                      class="btn small ghost"
                      onclick="
                        revokeCertificate(
                          '${cert.id}'
                        )
                      "
                    >
                      Revoke
                    </button>
                    `

                  : ""

              }

            </td>

          </tr>

          `;

        }).join("")

      : `
        <tr>
          <td colspan="6">
            No certificates issued yet.
          </td>
        </tr>
      `;


  loadCompletedEnrollmentOptions();

}


function loadCompletedEnrollmentOptions() {

  const select =
    $("certificateEnrollment");


  if (!select)
    return;


  const completed =
    enrollments.filter(
      enrollment =>
        enrollment.status ===
        "completed"
    );


  select.innerHTML =
    `
    <option value="">
      Select completed enrollment
    </option>
    `;


  completed.forEach(
    enrollment => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        enrollment.id;


      option.textContent =
        `${
          enrollment.students
            ?.student_code ||
          ""
        } — ${
          enrollment.students
            ?.full_name ||
          ""
        } — ${
          enrollment.courses
            ?.name ||
          ""
        } — ${
          enrollment.enrollment_no
        }`;


      select.appendChild(
        option
      );

    }
  );

}


$("certificateForm").onsubmit =
  async event => {

    event.preventDefault();


    try {

      const enrollmentId =
        $("certificateEnrollment")
          .value;


      if (!enrollmentId)
        throw new Error(
          "Please select a completed enrollment."
        );


      const {
        data: { user }
      } = await sb.auth.getUser();


      if (!user)
        throw new Error(
          "Please login again."
        );


      const {
        error
      } = await sb
        .from("certificates")
        .insert({
          enrollment_id:
            enrollmentId,

          issue_date:
            $("certificateIssueDate")
              .value,

          status:
            "issued",

          created_by:
            user.id
        });


      if (error)
        throw error;


      note(
        "certificateMsg",
        "Certificate issued successfully."
      );


      $("certificateForm")
        .reset();


      setDefaultCertificateDate();


      await loadCertificates();


    } catch (error) {

      note(
        "certificateMsg",
        error.message ||
          String(error),
        true
      );

    }

  };


window.revokeCertificate =
  async id => {

    if (
      !confirm(
        "Revoke this certificate?"
      )
    )
      return;


    const {
      error
    } = await sb
      .from("certificates")
      .update({
        status: "revoked",
        updated_at:
          new Date().toISOString()
      })
      .eq(
        "id",
        id
      );


    if (error)
      return note(
        "certificateMsg",
        error.message,
        true
      );


    await loadCertificates();

  };


// ============================================================
// TABS
// ============================================================

function showTab(id) {

  document
    .querySelectorAll(
      ".tab-panel"
    )
    .forEach(
      panel => {

        panel.classList.toggle(
          "active",
          panel.id === id
        );

      }
    );


  document
    .querySelectorAll(
      ".tab-btn"
    )
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.tab ===
            id
        );

      }
    );

}


document
  .querySelectorAll(
    ".tab-btn"
  )
  .forEach(
    button => {

      button.onclick =
        () =>
          showTab(
            button.dataset.tab
          );

    }
  );


// ============================================================
// DEFAULT CERTIFICATE DATE
// ============================================================

function setDefaultCertificateDate() {

  const input =
    $("certificateIssueDate");


  if (!input)
    return;


  const today =
    new Date()
      .toISOString()
      .split("T")[0];


  input.value =
    today;

}


// ============================================================
// LOGOUT
// ============================================================

$("logout").onclick =
  async () => {

    await sb.auth.signOut();

    location.href =
      "index.html";

  };


// ============================================================
// START
// ============================================================

setDefaultCertificateDate();

guard();
