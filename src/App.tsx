import { Navigate, Route, Routes } from "react-router-dom";
import { DisplayPage } from "@/pages/DisplayPage";
import { SetupPage } from "@/pages/SetupPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<SetupPage />} />
      <Route path="/display/:zoneId" element={<DisplayPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
