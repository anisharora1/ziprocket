import Image from "next/image";
import { MdMenu } from "react-icons/md";

export default function AdminHeader() {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-center text-center sticky top-0 z-20">
      <h1 className="font-semibold text-slate-800 text-[16px]">Platform Overview</h1>
    </header>
  );
}
