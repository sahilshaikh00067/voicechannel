import { useState } from "react";
import { NavLink, useNavigate, Outlet } from "react-router-dom";

import {
  Sidebar,
  Menu,
  MenuItem,
  SubMenu,
} from "react-pro-sidebar";

import { IoMenu } from "react-icons/io5";
import { PiFileAudioBold } from "react-icons/pi";
import { TbLivePhotoFilled } from "react-icons/tb";
import { ImProfile } from "react-icons/im";
import { TbReport } from "react-icons/tb";
import { MdDashboard } from "react-icons/md";
import { PiPhoneCallFill } from "react-icons/pi";
import { BsFillPeopleFill } from "react-icons/bs";
import { MdKeyboardArrowDown } from "react-icons/md";
import { FiLogOut } from "react-icons/fi";
import { FaWallet } from "react-icons/fa";
import profile from "../assets/Images/profile.png";

import {
  Dialog,
  DialogPanel,
} from "@headlessui/react";

import {
  Bars3Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export default function Header() {

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const navigate = useNavigate();

  const role = sessionStorage.getItem("role")?.toLowerCase();
  const sessionUser = JSON.parse(sessionStorage.getItem("user"));
  const currentUser = sessionUser;
  const currentCredit = Number(currentUser?.credit || 0);

  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/login");
  };

  return (
    <div className="bg-[#f5f5f5] min-h-screen overflow-x-hidden">

      {/* HEADER */}
      <header className="bg-white border-b border-[#efefef]">
        <nav className="flex items-center justify-between px-4 md:px-7 py-5">

          {/* LEFT */}
          <div className="flex items-center gap-4 md:gap-6">
            <h2 className="text-[15px] md:text-[19px] font-semibold text-[#666] tracking-wide whitespace-nowrap">
              VOICECHANNEL.IN
            </h2>

            <button
              onClick={() => setCollapsed(!collapsed)}
              className="text-[#EA7A9A] duration-300 hover:scale-105"
            >
              <IoMenu size={32} />
            </button>

            <div className="hidden md:block">
              <h2 className="text-[24px] font-bold text-black leading-none">Dashboard</h2>
              <p className="text-[#b9b1a9] text-[13px] mt-1 font-medium">Welcome to InfraVoice !</p>
            </div>
          </div>

          {/* RIGHT */}
          <div className="hidden lg:flex items-center gap-5">
            <div className="relative">

              <div
                onClick={() => setShowProfile(!showProfile)}
                className="flex items-center gap-3 ml-2 cursor-pointer bg-[#fffafb] border border-[#ef7fa4] rounded-full py-2 pl-2 pr-5 hover:shadow-sm duration-300"
              >
                <img
                  src={profile}
                  alt="profile"
                  className="w-[55px] h-[55px] rounded-full object-cover border border-[#ef7fa4]"
                />
                <div>
                  <h2 className="text-[#2f3778] text-[18px] font-[700] leading-none">
                    {currentUser?.username || "InfraVoice"}
                  </h2>
                  <p className="text-[#EA7A9A] text-[13px] mt-1 font-medium capitalize">{role}</p>
                </div>
              </div>

              {/* DROPDOWN */}
              {showProfile && (
                <div className="absolute right-0 top-[82px] w-[320px] bg-white border border-[#ef7fa4] rounded-[26px] overflow-hidden shadow-xl z-50">
                  <div className="bg-[#fffafb] px-3 py-3 border-b border-[#f3d3dc]">
                    <div className="flex items-center gap-4">
                      <img src={profile} alt="profile" className="w-[70px] h-[70px] rounded-full border border-[#ef7fa4]" />
                      <div>
                        <h1 className="text-[22px] font-[700] text-[#2f3778]">{currentUser?.username || "InfraVoice"}</h1>
                        <p className="text-[#EA7A9A] text-[14px] capitalize mt-1">{role}</p>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-3">
                    <div className="bg-[#fffafb] border border-[#ef7fa4] rounded-[22px] p-3">
                      <div className="flex items-center gap-4">
                        <div className="w-[58px] h-[58px] rounded-2xl bg-[#EA7A9A] flex items-center justify-center">
                          <FaWallet size={24} className="text-white" />
                        </div>
                        <div>
                          <p className="text-[13px] text-gray-500 font-medium">Available Credit</p>
                          <h1 className="text-[24px] font-[800] text-[#EA7A9A] leading-none mt-1">
                            ₹ {Number(currentCredit).toLocaleString()}
                          </h1>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full h-[54px] rounded-2xl bg-[#EA7A9A] hover:bg-[#e3688b] duration-300 text-white text-[15px] font-semibold flex items-center justify-center gap-3 mt-5"
                    >
                      <FiLogOut size={18} />
                      Logout
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* MOBILE TOGGLE */}
          <div className="lg:hidden">
            <button onClick={() => setMobileMenuOpen(true)}>
              <Bars3Icon className="w-7" />
            </button>
          </div>

        </nav>

        {/* MOBILE MENU */}
        <Dialog open={mobileMenuOpen} onClose={setMobileMenuOpen}>
          <DialogPanel className="fixed inset-y-0 right-0 w-full bg-white p-6 z-50 overflow-y-auto">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-xl">Menu</h2>
              <button onClick={() => setMobileMenuOpen(false)}>
                <XMarkIcon className="w-6" />
              </button>
            </div>
            <div className="mt-7 bg-[#fffafb] border border-[#ef7fa4] rounded-[24px] p-5">
              <div className="flex items-center gap-4">
                <img src={profile} alt="profile" className="w-[65px] h-[65px] rounded-full border border-[#ef7fa4]" />
                <div>
                  <h2 className="text-[22px] font-[700] text-[#2f3778]">{currentUser?.username || "InfraVoice"}</h2>
                  <p className="text-[#EA7A9A] text-[14px] capitalize">{role}</p>
                </div>
              </div>
              <div className="mt-5 bg-white border border-[#ef7fa4] rounded-[20px] p-4">
                <p className="text-[13px] text-gray-500">Available Credit</p>
                <h1 className="text-[30px] font-[800] text-[#EA7A9A] mt-1">₹ {currentCredit}</h1>
              </div>
              <button onClick={handleLogout} className="w-full h-[50px] rounded-2xl bg-[#EA7A9A] text-white text-[15px] font-semibold mt-5">
                Logout
              </button>
            </div>
            <div className="mt-8 flex flex-col gap-5">
              <NavLink to="/dashboard">Dashboard</NavLink>
              <NavLink to="/voicecampaign">Voice Campaign</NavLink>
              <NavLink to="/audiofile">Voice File</NavLink>
              <NavLink to="/campaignreports">Manage Campaign</NavLink>
              <NavLink to="/schedulereport">Live Report</NavLink>
              {role !== "user" && (
                <>
                  <NavLink to="/adduser">Add User</NavLink>
                  <NavLink to="/manageuser">Manage User</NavLink>
                </>
              )}
            </div>
          </DialogPanel>
        </Dialog>

      </header>

      {/* MAIN */}
      <div className="flex">

        {/* SIDEBAR WRAPPER — smooth width transition here, NOT inside Sidebar */}
        <div
          style={{
            width: collapsed ? "80px" : "270px",
            minWidth: collapsed ? "80px" : "270px",
            transition: "width 0.38s cubic-bezier(0.4,0,0.2,1), min-width 0.38s cubic-bezier(0.4,0,0.2,1)",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <Sidebar
            collapsed={collapsed}
            width="270px"
            collapsedWidth="80px"
            transitionDuration={380}
            rootStyles={{
              height: "100vh",
              border: "none",
              position: "sticky",
              top: 0,
              ".ps-sidebar-container": {
                backgroundColor: "#fff",
                overflowX: "hidden",
              },
            }}
          >
            <Menu
              menuItemStyles={{
                button: ({ active }) => ({
                  height: "52px",
                  borderRadius: "14px",
                  margin: "4px 10px",
                  fontSize: "15px",
                  fontWeight: "500",
                  color: active ? "white" : "#333",
                  backgroundColor: active ? "#EA7A9A" : "transparent",
                  transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
                  // Hide text shadow/overflow during collapse
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  "&:hover": {
                    backgroundColor: "#EA7A9A",
                    color: "white",
                    borderRadius: "30px",
                  },
                }),
                icon: ({ active }) => ({
                  color: active ? "white" : "#666",
                  fontSize: "18px",
                  transition: "color 0.3s ease",
                  flexShrink: 0,
                  minWidth: "20px",
                }),
                label: {
                  // Fade out smoothly during collapse
                  opacity: collapsed ? 0 : 1,
                  transition: "opacity 0.2s ease",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                },
              }}
            >

              {/* DASHBOARD */}
              <MenuItem
                icon={<MdDashboard />}
                component={<NavLink to="/dashboard" />}
                className={({ isActive }) =>
                  isActive ? "activeMenu dashboardMenu" : "dashboardMenu"
                }
              >
                Dashboard
              </MenuItem>

              {/* VOICE */}
              <SubMenu
                label="Voice Campaign"
                icon={<PiPhoneCallFill />}
                suffix={collapsed ? null : <MdKeyboardArrowDown />}
                className="submenuStyle"
              >
                <MenuItem component={<NavLink to="/voicecampaign" />}>
                  Voice Campaign
                </MenuItem>
              </SubMenu>

              {/* AUDIO */}
              <SubMenu
                label="Voice File"
                icon={<PiFileAudioBold />}
                suffix={collapsed ? null : <MdKeyboardArrowDown />}
                className="submenuStyle"
              >
                <MenuItem component={<NavLink to="/audiofile" />}>
                  Audio File
                </MenuItem>
              </SubMenu>

              {/* REPORT */}
              <SubMenu
                label="Manage Campaign"
                icon={<TbReport />}
                suffix={collapsed ? null : <MdKeyboardArrowDown />}
                className="submenuStyle"
              >
                <MenuItem component={<NavLink to="/campaignreports" />}>
                  My Campaign
                </MenuItem>
              </SubMenu>

              {/* LIVE */}
              <SubMenu
                label="Live Report"
                icon={<TbLivePhotoFilled />}
                suffix={collapsed ? null : <MdKeyboardArrowDown />}
                className="submenuStyle"
              >
                <MenuItem component={<NavLink to="/schedulereport" />}>
                  Schedule Reports
                </MenuItem>
                <MenuItem component={<NavLink to="/credithistory" />}>
                  Credit History
                </MenuItem>
              </SubMenu>

              {/* USER */}
              {role !== "user" && (
                <SubMenu
                  label="User Management"
                  icon={<BsFillPeopleFill />}
                  suffix={collapsed ? null : <MdKeyboardArrowDown />}
                  className="submenuStyle"
                >
                  <MenuItem component={<NavLink to="/adduser" />}>
                    Add User
                  </MenuItem>
                  <MenuItem component={<NavLink to="/manageuser" />}>
                    Manage User
                  </MenuItem>
                </SubMenu>
              )}

              {/* PROFILE */}
              <SubMenu
                label="Profile"
                icon={<ImProfile />}
                suffix={collapsed ? null : <MdKeyboardArrowDown />}
                className="submenuStyle"
              >
                <MenuItem component={<NavLink to="/changepassword" />}>
                  Change Password
                </MenuItem>
              </SubMenu>

            </Menu>
          </Sidebar>
        </div>

        {/* RIGHT CONTENT */}
        <div
          className="flex-1 p-3 md:p-4 overflow-x-hidden"
          style={{ transition: "all 0.38s cubic-bezier(0.4,0,0.2,1)" }}
        >
          <Outlet />
        </div>

      </div>

      {/* CSS */}
      <style>{`

        /* === BASE BUTTON === */
        .ps-menu-button {
          height: 52px !important;
          border-radius: 14px !important;
          margin: 4px 10px !important;
          font-size: 15px !important;
          font-weight: 500 !important;
          color: #333 !important;
          transition: background 0.3s cubic-bezier(0.4,0,0.2,1),
                      color 0.3s cubic-bezier(0.4,0,0.2,1),
                      border-radius 0.3s cubic-bezier(0.4,0,0.2,1),
                      box-shadow 0.3s ease !important;
          white-space: nowrap !important;
          overflow: hidden !important;
        }

        .ps-menu-button:hover {
          color: #EA7A9A !important;
          background: transparent !important;
        }

        .ps-menu-button:hover .ps-menu-icon {
          color: #EA7A9A !important;
        }

        /* === ICON === */
        .ps-menu-icon {
          font-size: 18px !important;
          color: #666 !important;
          transition: color 0.3s ease !important;
          flex-shrink: 0 !important;
          min-width: 20px !important;
        }

        /* === DASHBOARD ACTIVE/HOVER === */
        .dashboardMenu > .ps-menu-button:hover,
        .dashboardMenu:hover .ps-menu-button {
          background: #EA7A9A !important;
          color: white !important;
          border-radius: 30px !important;
        }

        .dashboardMenu > .ps-menu-button:hover .ps-menu-icon,
        .dashboardMenu:hover .ps-menu-icon {
          color: white !important;
        }

        .activeMenu .ps-menu-button {
          background: #EA7A9A !important;
          color: white !important;
          border-radius: 30px !important;
        }

        .activeMenu .ps-menu-icon {
          color: white !important;
        }

        /* === SUBMENU PARENT HOVER === */
        .ps-submenu-root > .ps-menu-button:hover {
          background: #EA7A9A !important;
          color: white !important;
          border-radius: 30px !important;
        }

        .ps-submenu-root > .ps-menu-button:hover .ps-menu-icon,
        .ps-submenu-root > .ps-menu-button:hover .ps-submenu-expand-icon {
          color: white !important;
        }

        /* === SUBMENU OPEN === */
        .ps-submenu-root.ps-open > .ps-menu-button {
          background: #EA7A9A !important;
          color: white !important;
          border-radius: 30px !important;
        }

        .ps-submenu-root.ps-open > .ps-menu-button .ps-menu-icon,
        .ps-submenu-root.ps-open > .ps-menu-button .ps-submenu-expand-icon {
          color: white !important;
        }

        /* === SUBMENU ARROW === */
        .ps-submenu-expand-icon {
          color: #888 !important;
          transition: transform 0.3s cubic-bezier(0.4,0,0.2,1),
                      color 0.3s ease !important;
        }

        .ps-submenu-root.ps-open > .ps-menu-button .ps-submenu-expand-icon {
          transform: rotate(180deg) !important;
        }

        /* === SUBMENU CONTENT SLIDE === */
        .ps-submenu-content {
          background: #fff !important;
          border-radius: 10px !important;
          margin: 0 8px !important;
          overflow: hidden !important;
          transition: height 0.32s cubic-bezier(0.4,0,0.2,1) !important;
        }

        .ps-submenu-content .ps-menu-button {
          height: 44px !important;
          border-radius: 10px !important;
          font-size: 14px !important;
          margin: 2px 8px !important;
          color: #555 !important;
        }

        .ps-submenu-content .ps-menu-button:hover {
          background: #fdf0f4 !important;
          color: #EA7A9A !important;
          border-radius: 10px !important;
        }

        /* === HIDE TEXT CLEANLY WHEN COLLAPSED === */
        .ps-collapsed .ps-menu-label,
        .ps-collapsed .ps-submenu-expand-icon,
        .ps-collapsed .ps-menuitem-root > .ps-menu-button > span {
          opacity: 0 !important;
          width: 0 !important;
          overflow: hidden !important;
          transition: opacity 0.15s ease, width 0.15s ease !important;
        }

        /* === COLLAPSED ICON CENTERED === */
        .ps-collapsed .ps-menu-button {
          justify-content: center !important;
          padding: 0 !important;
          margin: 6px auto !important;
          width: 52px !important;
          border-radius: 16px !important;
        }

        .ps-collapsed .ps-menu-icon {
          margin: 0 auto !important;
        }

        /* === SIDEBAR SCROLL === */
        .ps-sidebar-container {
          overflow-x: hidden !important;
        }

        .ps-sidebar-container::-webkit-scrollbar {
          width: 3px;
        }

        .ps-sidebar-container::-webkit-scrollbar-thumb {
          background: #f3d3dc;
          border-radius: 99px;
        }

      `}</style>

    </div>
  );
}