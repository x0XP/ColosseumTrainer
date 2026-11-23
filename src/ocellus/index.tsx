import React from "react";
import { createRoot } from "react-dom/client";
import { OcellusApp } from "./OcellusApp";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");
createRoot(root).render(React.createElement(OcellusApp));
