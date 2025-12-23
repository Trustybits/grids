import { motion } from "motion/react";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface NeonTileProps {
  title: string;
  handle: string;
  iconPath: string;
  bgShapePath?: string;
  color?: string; // Made optional with default
  className?: string;
}

export function NeonTile({
  title,
  handle,
  iconPath,
  bgShapePath = "M24 0.552C24 0.247139 24.2472 -0.00066293 24.552 0.00634677C29.1058 0.11108 33.54 1.5099 37.3337 4.04473C41.2805 6.68188 44.3566 10.4302 46.1731 14.8156C47.9896 19.201 48.4649 24.0266 47.5388 28.6822C46.6128 33.3377 44.327 37.6141 40.9706 40.9706C37.6141 44.327 33.3377 46.6128 28.6822 47.5388C24.0266 48.4649 19.201 47.9896 14.8156 46.1731C10.4302 44.3566 6.68188 41.2805 4.04473 37.3337C1.5099 33.54 0.11108 29.1058 0.00634677 24.552C-0.000662933 24.2472 0.247139 24 0.552 24V24C0.856861 24 1.10331 24.2472 1.11065 24.552C1.21517 28.8874 2.54915 33.1083 4.96267 36.7203C7.47852 40.4856 11.0544 43.4202 15.2381 45.1531C19.4218 46.8861 24.0254 47.3395 28.4668 46.4561C32.9082 45.5726 36.9879 43.392 40.1899 40.1899C43.392 36.9879 45.5726 32.9082 46.4561 28.4668C47.3395 24.0254 46.8861 19.4218 45.1531 15.2381C43.4202 11.0544 40.4856 7.47852 36.7203 4.96267C33.1083 2.54915 28.8874 1.21517 24.552 1.11065C24.2472 1.10331 24 0.856861 24 0.552V0.552Z",
  color = "#ffffff", // Default color white if not provided
  className,
}: NeonTileProps) {
  
  // Variants for the glow effect
  const glowVariants = {
    initial: { opacity: 0 },
    hover: { 
      opacity: 1,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    }
  };

  // Flicker effect for the light itself
  const flickerVariants = {
    initial: { opacity: 0 },
    hover: {
      opacity: [0.8, 1, 0.9, 1, 0.85, 1],
      transition: {
        duration: 0.4,
        repeat: Infinity,
        repeatType: "reverse" as const,
        ease: "linear"
      }
    }
  };

  // Icon glow variants
  const iconGlowVariants = {
    initial: { opacity: 0 },
    hover: { 
      opacity: 1,
      transition: {
        duration: 0.2,
        ease: "easeOut"
      }
    }
  };

  // Ring glow variants
  const ringVariants = {
    initial: { 
      fill: "#ffffff", 
      fillOpacity: 0.34, 
      filter: "drop-shadow(0 0 0px rgba(255,255,255,0))"
    },
    hover: { 
      fill: color, 
      fillOpacity: 1,
      filter: `drop-shadow(0 0 10px ${color})`,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    }
  };

  return (
    <motion.div
      className={cn(
        "group relative flex flex-col items-start gap-2 overflow-hidden rounded-[34px] bg-[#181818] p-1",
        "w-[260px] h-[260px]",
        className
      )}
      whileHover="hover"
      initial="initial"
    >
      {/* Background Content Container */}
      <div className="relative z-10 flex size-full flex-col justify-between rounded-[30px] bg-black/50 p-6 backdrop-blur-sm transition-colors duration-300">
        
        {/* Logo Section */}
        <div className="relative size-[48px]">
           <svg className="block size-full overflow-visible" fill="none" preserveAspectRatio="none" viewBox="0 0 48 48">
             <g id="NeonLogos">
               {/* Container Circle */}
               <circle cx="24" cy="24" fill="white" fillOpacity="0.01" r="24" />
               
               {/* Background Shape */}
               <motion.path 
                 d={bgShapePath} 
                 variants={ringVariants}
               />
               
               {/* Icon Path - Base (dim) */}
               <path d={iconPath} stroke="white" strokeOpacity="0.34" strokeWidth="0.96" />
               
               {/* Lit Icon (Overlay) - Animate opacity on hover */}
               <motion.path 
                 d={iconPath} 
                 stroke="white" 
                 strokeWidth="1.5"
                 variants={iconGlowVariants}
                 className="drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
               />
             </g>
           </svg>
        </div>

        {/* Text Section */}
        <div className="flex flex-col gap-[3px]">
          <p className="font-['Inter'] text-[16px] font-semibold text-[#fbfbfb]">{title}</p>
          <p className="font-['Inter'] text-[12px] font-normal text-[#fbfbfb] opacity-60">{handle}</p>
        </div>
      </div>

      {/* Inactive Glow (Ambient) - Always visible, subtle */}
      <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-[80px] top-[174px] size-[252px] opacity-10">
             <div className="size-full rounded-full bg-white blur-[60px]" />
          </div>
      </div>

      {/* Active Neon Glow - Animated */}
      <motion.div 
        className="absolute pointer-events-none inset-0 z-0"
        variants={glowVariants}
      >
         {/* Main colorful glow */}
         <div 
           className="absolute -left-[100px] top-[140px] size-[300px] rounded-full blur-[80px]"
           style={{ backgroundColor: color, opacity: 0.6 }}
         />
         
         {/* Intense core glow */}
         <motion.div 
           className="absolute -left-[60px] top-[180px] size-[200px] rounded-full blur-[50px]"
           style={{ backgroundColor: color }}
           variants={flickerVariants}
         />
      </motion.div>
      
    </motion.div>
  );
}
