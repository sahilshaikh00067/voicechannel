import React, { useState } from "react";
import {
  LockKeyhole,
  ShieldCheck,
  KeyRound,
} from "lucide-react";

const ChangePassword = () => {

  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleChange = (e) => {

    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });

  };

  // ✅ SUBMIT
  const handleSubmit = (e) => {

    e.preventDefault();

    const currentUser = JSON.parse(
      sessionStorage.getItem("user")
    );

    if (!currentUser) {

      alert("User not logged in ❌");

      return;

    }

    const users =
      JSON.parse(
        localStorage.getItem("users")
      ) || [];

    const userIndex = users.findIndex(
      (u) =>
        u.username ===
        currentUser.username
    );

    if (userIndex === -1) {

      alert("User not found ❌");

      return;

    }

    // ✅ CHECK CURRENT PASSWORD
    if (
      users[userIndex].password !==
      form.currentPassword
    ) {

      alert(
        "Current password incorrect ❌"
      );

      return;

    }

    // ✅ VALIDATION
    if (
      form.newPassword.length < 3
    ) {

      alert(
        "New password must be at least 3 characters ❌"
      );

      return;

    }

    if (
      form.newPassword !==
      form.confirmPassword
    ) {

      alert(
        "Passwords do not match ❌"
      );

      return;

    }

    // ✅ UPDATE PASSWORD
    users[userIndex].password =
      form.newPassword;

    localStorage.setItem(
      "users",
      JSON.stringify(users)
    );

    // ✅ UPDATE SESSION
    sessionStorage.setItem(
      "user",
      JSON.stringify(
        users[userIndex]
      )
    );

    alert(
      "Password Changed Successfully ✅"
    );

    // ✅ RESET
    setForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });

  };

  return (

    <div className="min-h-screen bg-[#f8f8f8] p-3 md:p-5 flex justify-center items-center">

      {/* MAIN CARD */}
      <div className="w-full max-w-[650px] bg-white rounded-[30px] border border-[#ef7fa4] overflow-hidden shadow-sm">

        {/* HEADER */}
        <div className="px-7 py-6 border-b border-[#f5d1db] bg-[#fffafb]">

          <div className="flex items-center gap-4">

            {/* ICON */}
            <div className="w-[62px] h-[62px] rounded-2xl bg-[#fff0f4] border border-[#ef7fa4] flex items-center justify-center">

              <ShieldCheck
                size={28}
                className="text-[#EA7A9A]"
              />

            </div>

            {/* TEXT */}
            <div>

              <h1 className="text-[30px] font-[700] text-[#EA7A9A]">
                Change Password
              </h1>

              <p className="text-[14px] text-gray-500 mt-1">
                Secure your account password
              </p>

            </div>

          </div>

        </div>

        {/* BODY */}
        <div className="p-6 md:p-7">

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >

            {/* CURRENT PASSWORD */}
            <div>

              <label className="label">
                Current Password
              </label>

              <div className="inputBox">

                <LockKeyhole
                  size={18}
                  className="icon"
                />

                <input
                  type="password"
                  name="currentPassword"
                  value={
                    form.currentPassword
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Enter Current Password"
                  className="input"
                />

              </div>

            </div>

            {/* NEW PASSWORD */}
            <div>

              <label className="label">
                New Password
              </label>

              <div className="inputBox">

                <KeyRound
                  size={18}
                  className="icon"
                />

                <input
                  type="password"
                  name="newPassword"
                  value={
                    form.newPassword
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Enter New Password"
                  className="input"
                />

              </div>

            </div>

            {/* CONFIRM PASSWORD */}
            <div>

              <label className="label">
                Confirm Password
              </label>

              <div className="inputBox">

                <KeyRound
                  size={18}
                  className="icon"
                />

                <input
                  type="password"
                  name="confirmPassword"
                  value={
                    form.confirmPassword
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Confirm New Password"
                  className="input"
                />

              </div>

            </div>

            {/* BUTTON */}
            <button
              type="submit"
              className="w-full h-[56px] rounded-2xl bg-[#EA7A9A] hover:bg-[#e3688b] duration-300 text-white text-[16px] font-semibold shadow-sm mt-2"
            >

              Update Password

            </button>

          </form>

        </div>

      </div>

      {/* CSS */}
      <style>{`

        .label{
          display:block;
          margin-bottom:10px;
          font-size:14px;
          font-weight:600;
          color:#EA7A9A;
        }

        .inputBox{
          width:100%;
          height:58px;
          border:1px solid #ef7fa4;
          border-radius:18px;
          background:#fffafb;
          display:flex;
          align-items:center;
          padding:0 18px;
          transition:0.3s;
        }

        .inputBox:focus-within{
          border:1px solid #EA7A9A;
          background:white;
          box-shadow:0 0 0 4px rgba(234,122,154,0.10);
        }

        .icon{
          color:#EA7A9A;
          min-width:18px;
        }

        .input{
          width:100%;
          height:100%;
          border:none;
          outline:none;
          background:transparent;
          padding-left:14px;
          font-size:15px;
          color:#111827;
        }

        .input::placeholder{
          color:#9ca3af;
        }

      `}</style>

    </div>
  );
};

export default ChangePassword;