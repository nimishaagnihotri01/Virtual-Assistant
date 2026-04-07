import orbit from "../assets/robot-hd/robot-orbit.jpg";
import pulse from "../assets/robot-hd/robot-pulse.jpg";
import sentinel from "../assets/robot-hd/robot-sentinel.jpg";
import zenith from "../assets/robot-hd/robot-zenith.jpg";

const robotOptions = [
  {
    id: "zenith",
    name: "Zenith",
    description: "Polished studio lighting with a calm command-center posture and premium white alloy finish.",
    mood: "Command-grade",
    tag: "Blue studio glow",
    src: zenith,
    objectPosition: "center center",
  },
  {
    id: "sentinel",
    name: "Sentinel",
    description: "Sharper contrast, darker atmosphere, and a more focused guardian look for a serious assistant.",
    mood: "Security-ready",
    tag: "Shadow detail",
    src: sentinel,
    objectPosition: "center center",
  },
  {
    id: "pulse",
    name: "Pulse",
    description: "Bright digital face, lively reflections, and a futuristic glow that feels social and expressive.",
    mood: "High-energy",
    tag: "Neon network",
    src: pulse,
    objectPosition: "center center",
  },
  {
    id: "orbit",
    name: "Orbit",
    description: "Close-range optics with a cinematic blue core, ideal for a sleek assistant with personality.",
    mood: "Precision lens",
    tag: "Cinematic close-up",
    src: orbit,
    objectPosition: "center top",
  },
];

export default robotOptions;
