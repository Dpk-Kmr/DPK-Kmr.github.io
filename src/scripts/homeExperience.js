document.addEventListener("DOMContentLoaded", () => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    setupEntryMotion(reducedMotion);
    setupCurrentNav();
    setupTaglineHandoff(reducedMotion);

    const heroGear = new HeroGearCore({
        canvas: document.getElementById("heroPhysicsCanvas"),
        speedReadout: document.querySelector("[data-speed-readout]"),
        directionReadout: document.querySelector("[data-direction-readout]"),
        hud: document.querySelector(".core-hud"),
        reducedMotion
    });
    const orbitButtons = setupOrbitButtons({
        root: document.querySelector("[data-orbit-nav]"),
        buttons: Array.from(document.querySelectorAll("[data-orbit-button]")),
        reducedMotion
    });
    const mechanism = setupMechanism();
    const aiMatrix = setupAIMatrix();
    const skillTrajectory = setupSkillTrajectory();

    let lastTime = performance.now();

    const frame = (time) => {
        const delta = Math.min((time - lastTime) / 1000, 0.033);
        lastTime = time;

        heroGear.update(delta, time);
        orbitButtons.update(delta);
        mechanism.update(time / 1000);
        aiMatrix.update(time / 1000);
        skillTrajectory.update(time / 1000);

        if (!reducedMotion) {
            window.requestAnimationFrame(frame);
        }
    };

    frame(lastTime);

    if (!reducedMotion) {
        window.requestAnimationFrame(frame);
    }
});

function setupTaglineHandoff(reducedMotion) {
    const heroTagline = document.querySelector("[data-hero-tagline]");
    const headerTagline = document.querySelector("[data-header-tagline]");
    const brandLockup = headerTagline?.closest(".brand-lockup, .catalog-brand-lockup");
    const headerShell = headerTagline?.closest(".site-nav, .catalog-nav");
    const sourcePart = document.querySelector("[data-tagline-source]");
    const targetPart = document.querySelector("[data-tagline-target]");
    const supportingCopy = heroTagline?.parentElement?.querySelector(".hero-subtext, p");

    if (!heroTagline || !headerTagline || !brandLockup || !headerShell || !sourcePart || !targetPart || !supportingCopy) {
        return;
    }

    document.body.classList.add("tagline-handoff-ready");

    const placeholder = sourcePart.cloneNode(true);
    placeholder.removeAttribute("data-tagline-source");
    placeholder.className = "tagline-layout-placeholder";
    sourcePart.replaceWith(placeholder);

    sourcePart.className = "tagline-moving-part";
    sourcePart.setAttribute("aria-hidden", "true");
    document.body.append(sourcePart);

    let startScroll = 0;
    let endScroll = 1;
    let sourcePageLeft = 0;
    let sourcePageTop = 0;
    let sourceWidth = 1;
    let sourceHeight = 1;
    let supportingCopyPageTop = 0;
    let sourceFontSize = "1rem";
    let sourceFontWeight = "900";
    let sourceLineHeight = "1";
    let sourceLetterSpacing = "normal";
    let ticking = false;

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const lerp = (start, end, progress) => start + (end - start) * progress;

    const measure = () => {
        const sourceRect = placeholder.getBoundingClientRect();
        const headerRect = headerShell.getBoundingClientRect();
        const sourceStyle = getComputedStyle(placeholder);

        sourcePageLeft = sourceRect.left + window.scrollX;
        sourcePageTop = sourceRect.top + window.scrollY;
        sourceWidth = Math.max(sourceRect.width, 1);
        sourceHeight = Math.max(sourceRect.height, 1);
        supportingCopyPageTop = supportingCopy.getBoundingClientRect().top + window.scrollY;
        sourceFontSize = sourceStyle.fontSize;
        sourceFontWeight = sourceStyle.fontWeight;
        sourceLineHeight = sourceStyle.lineHeight;
        sourceLetterSpacing = sourceStyle.letterSpacing;

        startScroll = Math.max(0, sourcePageTop - headerRect.bottom - 120);
        endScroll = Math.max(startScroll + 160, sourcePageTop - headerRect.bottom + 36);
    };

    const render = () => {
        ticking = false;
        const rawProgress = clamp((window.scrollY - startScroll) / (endScroll - startScroll), 0, 1);
        const progress = reducedMotion ? (rawProgress >= 0.5 ? 1 : 0) : rawProgress;
        const targetReveal = clamp((progress - 0.78) / 0.22, 0, 1);
        const movingOpacity = 1 - clamp((progress - 0.7) / 0.24, 0, 1);
        const headerRect = headerShell.getBoundingClientRect();
        const targetRect = targetPart.getBoundingClientRect();
        const targetScale = targetRect.width / sourceWidth;
        const scale = lerp(1, targetScale, progress);
        const naturalSourceTop = sourcePageTop - window.scrollY;
        const safeTop = headerRect.bottom + 14;
        const supportingCopyTop = supportingCopyPageTop - window.scrollY;
        const maximumTop = supportingCopyTop - (sourceHeight * scale) - 18;
        const availableLane = maximumTop - safeTop;
        const destinationX = lerp(sourcePageLeft - window.scrollX, targetRect.left, progress);
        const destinationY = Math.min(Math.max(lerp(naturalSourceTop, safeTop, progress), safeTop), maximumTop);
        const laneOpacity = clamp(availableLane / 28, 0, 1);

        headerTagline.style.opacity = String(targetReveal);
        headerTagline.style.maxHeight = `${(18 * targetReveal).toFixed(2)}px`;
        headerTagline.style.transform = `translate3d(0, ${(4 * (1 - targetReveal)).toFixed(2)}px, 0)`;
        brandLockup.style.gap = `${(4 * targetReveal).toFixed(2)}px`;

        sourcePart.style.left = `${destinationX.toFixed(2)}px`;
        sourcePart.style.top = `${destinationY.toFixed(2)}px`;
        sourcePart.style.fontSize = sourceFontSize;
        sourcePart.style.fontWeight = sourceFontWeight;
        sourcePart.style.lineHeight = sourceLineHeight;
        sourcePart.style.letterSpacing = sourceLetterSpacing;
        sourcePart.style.transform = `scale(${scale.toFixed(5)})`;
        sourcePart.style.opacity = String((reducedMotion ? 1 - progress : movingOpacity) * laneOpacity);
    };

    const requestRender = () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(render);
    };

    const remeasure = () => {
        measure();
        requestRender();
    };

    measure();
    render();
    window.addEventListener("scroll", requestRender, { passive: true });
    window.addEventListener("resize", remeasure, { passive: true });
    window.addEventListener("load", remeasure, { once: true });
    document.fonts?.ready.then(remeasure);
}

function setupEntryMotion(reducedMotion) {
    if (reducedMotion) {
        return;
    }

    const revealItems = Array.from(document.querySelectorAll(".reveal"));

    if (window.gsap && window.ScrollTrigger) {
        window.gsap.registerPlugin(window.ScrollTrigger);
        revealItems.forEach((item) => {
            window.gsap.fromTo(
                item,
                { autoAlpha: 0, y: 28 },
                {
                    autoAlpha: 1,
                    y: 0,
                    duration: 0.82,
                    ease: "power3.out",
                    scrollTrigger: {
                        trigger: item,
                        start: "top 84%",
                        once: true
                    }
                }
            );
        });
        return;
    }

    document.documentElement.classList.add("motion-enabled");
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.18, rootMargin: "0px 0px -8% 0px" });

    revealItems.forEach((item) => {
        if (item.getBoundingClientRect().top < window.innerHeight * 0.92) {
            item.classList.add("is-visible");
            return;
        }

        observer.observe(item);
    });
}

function setupCurrentNav() {
    const links = Array.from(document.querySelectorAll(".nav-cluster a[href^='#']"));
    const sections = links
        .map((link) => document.querySelector(link.getAttribute("href")))
        .filter(Boolean);

    if (!links.length || !sections.length) {
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) {
                return;
            }

            links.forEach((link) => {
                link.classList.toggle("is-current", link.getAttribute("href") === `#${entry.target.id}`);
            });
        });
    }, { threshold: 0.42 });

    sections.forEach((section) => observer.observe(section));
}

class HeroGearCore {
    constructor({ canvas, speedReadout, directionReadout, hud, reducedMotion }) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext("2d") : null;
        this.speedReadout = speedReadout;
        this.directionReadout = directionReadout;
        this.hud = hud;
        this.reducedMotion = reducedMotion;
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.width = 0;
        this.height = 0;
        this.angle = 0;
        this.speed = 1.55;
        this.targetSpeed = 1.55;
        this.hovered = false;
        this.lastReadout = 0;

        if (!this.canvas || !this.ctx) {
            return;
        }

        this.resize();
        window.addEventListener("resize", () => this.resize(), { passive: true });

        this.canvas.addEventListener("pointerenter", (event) => {
            if (event.pointerType !== "touch") {
                this.setHover(true);
            }
        }, { passive: true });
        this.canvas.addEventListener("pointerleave", (event) => {
            if (event.pointerType !== "touch") {
                this.setHover(false);
            }
        }, { passive: true });
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        this.width = Math.max(320, rect.width);
        this.height = Math.max(260, rect.height);
        this.canvas.width = Math.round(this.width * this.dpr);
        this.canvas.height = Math.round(this.height * this.dpr);
    }

    setHover(isHovered) {
        this.hovered = isHovered;
        this.targetSpeed = isHovered ? -5.4 : 1.55;

        if (this.hud) {
            this.hud.classList.toggle("is-hot", isHovered);
        }
    }

    update(delta, time) {
        if (!this.ctx) {
            return;
        }

        if (!this.reducedMotion) {
            this.speed += (this.targetSpeed - this.speed) * (1 - Math.exp(-delta * 5.8));
            this.angle += this.speed * delta;
        }

        this.draw(time);
        this.updateReadouts(time);
    }

    draw(time) {
        const ctx = this.ctx;
        const size = Math.min(this.width, this.height);
        const gearRadius = clamp(size * 0.13, 46, 74);

        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.clearRect(0, 0, this.width, this.height);
        this.drawGrid(ctx, time);

        ctx.save();
        ctx.translate(this.width * 0.5, this.height * 0.52);
        this.drawControlField(ctx, gearRadius, time);
        this.drawGear(ctx, gearRadius);
        ctx.restore();
    }

    drawGrid(ctx, time) {
        const grid = 28;
        const drift = (time * 0.006) % grid;

        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(59, 130, 246, 0.13)";

        for (let x = -grid + drift; x <= this.width + grid; x += grid) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.height);
            ctx.stroke();
        }

        ctx.strokeStyle = "rgba(6, 182, 212, 0.11)";
        for (let y = -grid + drift; y <= this.height + grid; y += grid) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
            ctx.stroke();
        }

        ctx.restore();
    }

    drawControlField(ctx, radius, time) {
        const pulse = this.hovered ? 1 : 0.42 + Math.sin(time * 0.002) * 0.08;

        ctx.save();
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = `rgba(6, 182, 212, ${0.16 + pulse * 0.18})`;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.62, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(245, 158, 11, ${this.hovered ? 0.42 : 0.18})`;
        ctx.setLineDash([14, 12]);
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.27, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.restore();
    }

    drawGear(ctx, radius) {
        const teeth = 18;
        const innerRadius = radius * 0.82;
        const outerRadius = radius;

        ctx.save();
        ctx.rotate(this.angle);
        ctx.shadowColor = this.hovered ? "rgba(245, 158, 11, 0.72)" : "rgba(6, 182, 212, 0.58)";
        ctx.shadowBlur = this.hovered ? 32 : 22;

        ctx.beginPath();
        for (let index = 0; index < teeth * 2; index += 1) {
            const angle = index * Math.PI / teeth;
            const activeRadius = index % 2 === 0 ? outerRadius : innerRadius;
            const x = Math.cos(angle) * activeRadius;
            const y = Math.sin(angle) * activeRadius;

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fillStyle = "rgba(10, 12, 16, 0.96)";
        ctx.strokeStyle = this.hovered ? "rgba(245, 158, 11, 0.95)" : "rgba(6, 182, 212, 0.95)";
        ctx.lineWidth = 4;
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(226, 232, 240, 0.68)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.46, 0, Math.PI * 2);
        ctx.stroke();

        for (let index = 0; index < 6; index += 1) {
            ctx.rotate(Math.PI / 3);
            ctx.fillStyle = index % 2 ? "rgba(59, 130, 246, 0.78)" : "rgba(6, 182, 212, 0.78)";
            ctx.beginPath();
            ctx.roundRect(radius * 0.18, -4, radius * 0.52, 8, 4);
            ctx.fill();
        }

        ctx.fillStyle = "rgba(248, 250, 252, 0.92)";
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    updateReadouts(time) {
        if (time - this.lastReadout < 90) {
            return;
        }

        this.lastReadout = time;
        const rpm = Math.abs(this.speed) * 60 / (Math.PI * 2);

        if (this.speedReadout) {
            this.speedReadout.textContent = `speed ${rpm.toFixed(0)} RPM`;
        }

        if (this.directionReadout) {
            this.directionReadout.textContent = `direction ${this.speed >= 0 ? "CW" : "CCW"}`;
        }
    }
}

function setupOrbitButtons({ root, buttons, reducedMotion }) {
    const targetVelocity = reducedMotion ? 0 : 0.24;
    const bodies = buttons.map((button, index) => ({
        el: button,
        angle: -Math.PI / 2 + index * Math.PI * 2 / Math.max(buttons.length, 1),
        velocity: targetVelocity
    }));
    const brakeLocks = new Set();
    let systemBraking = false;

    if (!root || !bodies.length) {
        return { update() {} };
    }

    const setBrakeLock = (key, isLocked) => {
        if (isLocked) {
            brakeLocks.add(key);
        } else {
            brakeLocks.delete(key);
        }

        systemBraking = brakeLocks.size > 0;
        bodies.forEach((body) => {
            body.el.classList.toggle("is-braking", systemBraking);
        });
    };

    bodies.forEach((body, index) => {
        body.el.addEventListener("pointerenter", (event) => {
            if (event.pointerType !== "touch") {
                setBrakeLock(`pointer-${index}`, true);
            }
        });

        body.el.addEventListener("pointerleave", (event) => {
            if (event.pointerType !== "touch") {
                setBrakeLock(`pointer-${index}`, false);
            }
        });

        body.el.addEventListener("focus", () => {
            setBrakeLock(`focus-${index}`, true);
        });

        body.el.addEventListener("blur", () => {
            setBrakeLock(`focus-${index}`, false);
        });
    });

    return {
        update(delta) {
            const rect = root.getBoundingClientRect();
            const maxWidth = Math.max(...bodies.map((body) => body.el.offsetWidth || 0));
            const maxHeight = Math.max(...bodies.map((body) => body.el.offsetHeight || 0));
            const radiusX = Math.max(94, rect.width * 0.5 - maxWidth * 0.56 - 16);
            const radiusY = Math.max(78, rect.height * 0.5 - maxHeight * 0.68 - 18);

            bodies.forEach((body) => {
                if (systemBraking) {
                    body.velocity *= Math.exp(-delta * 9.5);
                    if (Math.abs(body.velocity) < 0.002) {
                        body.velocity = 0;
                    }
                } else {
                    body.velocity += (targetVelocity - body.velocity) * (1 - Math.exp(-delta * 3.8));
                }

                body.angle += body.velocity * delta;

                const x = Math.cos(body.angle) * radiusX;
                const y = Math.sin(body.angle) * radiusY;
                body.el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
            });
        }
    };
}

function setupMechanism() {
    const svg = document.querySelector("[data-precision-visual]");
    const armOne = document.querySelector("[data-arm-one]");
    const armTwo = document.querySelector("[data-arm-two]");
    const ghostArm = document.querySelector("[data-ghost-arm]");
    const jointOne = document.querySelector("[data-joint-one]");
    const jointTwo = document.querySelector("[data-joint-two]");
    const toolNode = document.querySelector("[data-tool-node]");
    const angleReadout = document.querySelector("[data-mech-angle]");
    const reachReadout = document.querySelector("[data-mech-reach]");
    const dimensionArc = document.querySelector("[data-dimension-arc]");
    const base = { x: 150, y: 330 };
    const linkOne = 172;
    const linkTwo = 196;
    const target = { x: 500, y: 235 };
    let lastInput = 0;

    const setCircle = (circle, point) => {
        if (!circle) {
            return;
        }
        circle.setAttribute("cx", point.x.toFixed(2));
        circle.setAttribute("cy", point.y.toFixed(2));
    };

    if (svg) {
        svg.addEventListener("pointermove", (event) => {
            const point = getSvgPoint(svg, event);
            target.x = clamp(point.x, 102, 640);
            target.y = clamp(point.y, 74, 350);
            lastInput = performance.now() / 1000;
        }, { passive: true });
    }

    return {
        update(time) {
            if (!armOne || !armTwo) {
                return;
            }

            if (time - lastInput > 1.25) {
                target.x = 475 + Math.cos(time * 0.72) * 92;
                target.y = 226 + Math.sin(time * 0.96) * 58;
            }

            const dx = target.x - base.x;
            const dy = target.y - base.y;
            const distance = clamp(Math.hypot(dx, dy), 72, linkOne + linkTwo - 10);
            const aim = Math.atan2(dy, dx);
            const shoulderOffset = Math.acos(clamp((distance ** 2 + linkOne ** 2 - linkTwo ** 2) / (2 * distance * linkOne), -1, 1));
            const theta = aim - shoulderOffset;
            const elbow = Math.acos(clamp((linkOne ** 2 + linkTwo ** 2 - distance ** 2) / (2 * linkOne * linkTwo), -1, 1));
            const elbowAngle = theta + Math.PI - elbow;
            const jointA = {
                x: base.x + Math.cos(theta) * linkOne,
                y: base.y + Math.sin(theta) * linkOne
            };
            const jointB = {
                x: jointA.x + Math.cos(elbowAngle) * linkTwo,
                y: jointA.y + Math.sin(elbowAngle) * linkTwo
            };
            const fullTurn = Math.PI * 2;
            const thetaCounterClockwise = ((-theta % fullTurn) + fullTurn) % fullTurn;
            const thetaDegrees = thetaCounterClockwise * 180 / Math.PI;
            const thetaText = `\u03b8 = ${thetaDegrees.toFixed(1)}\u00b0`;

            armOne.setAttribute("d", `M${base.x} ${base.y} L${jointA.x.toFixed(2)} ${jointA.y.toFixed(2)}`);
            armTwo.setAttribute("d", `M${jointA.x.toFixed(2)} ${jointA.y.toFixed(2)} L${jointB.x.toFixed(2)} ${jointB.y.toFixed(2)}`);

            if (ghostArm) {
                ghostArm.setAttribute("d", `M${base.x} ${base.y} L${jointA.x.toFixed(2)} ${jointA.y.toFixed(2)} L${jointB.x.toFixed(2)} ${jointB.y.toFixed(2)}`);
            }

            if (dimensionArc) {
                dimensionArc.setAttribute("d", buildArcPath(base, 58, 0, -thetaCounterClockwise, 42));
            }

            setCircle(jointOne, jointA);
            setCircle(jointTwo, jointB);
            setCircle(toolNode, jointB);

            if (angleReadout) {
                angleReadout.textContent = thetaText;
            }

            if (reachReadout) {
                reachReadout.textContent = `reach ${(distance / 410).toFixed(2)} m`;
            }
        }
    };
}

function setupAIMatrix() {
    const svg = document.querySelector("[data-ai-visual]");
    const stages = Array.from(document.querySelectorAll("[data-ai-stage]")).map((stage) => ({
        el: stage,
        x: Number(stage.dataset.x || 0),
        y: Number(stage.dataset.y || 0),
        name: stage.dataset.aiStage || "stage"
    }));
    const control = document.querySelector("[data-ai-control]");
    const pulse = document.querySelector("[data-ai-pulse]");
    const rotor = document.querySelector("[data-ai-rotor]");
    const gauge = document.querySelector("[data-ai-gauge]");
    const primaryReadout = document.querySelector("[data-ai-primary]");
    const secondaryReadout = document.querySelector("[data-ai-secondary]");
    const core = { x: 360, y: 215 };
    const target = { x: 360, y: 215 };
    const current = { x: 360, y: 215 };
    let lastTextUpdate = 0;
    let lastInput = 0;
    let lastFrame = performance.now() / 1000;
    let rotorAngle = 0;
    let activeIndex = 0;

    if (svg) {
        const moveTarget = (event) => {
            const point = getSvgPoint(svg, event);
            target.x = clamp(point.x, 185, 535);
            target.y = clamp(point.y, 175, 255);
            lastInput = performance.now() / 1000;
        };

        svg.addEventListener("pointermove", moveTarget, { passive: true });
        svg.addEventListener("pointerdown", moveTarget, { passive: true });
    }

    stages.forEach((stage, index) => {
        const activate = () => {
            activeIndex = index;
            target.x = stage.x;
            target.y = stage.y;
            lastInput = performance.now() / 1000;
        };

        stage.el.addEventListener("pointerenter", (event) => {
            if (event.pointerType !== "touch") {
                activate();
            }
        });
        stage.el.addEventListener("click", activate);
        stage.el.addEventListener("focus", activate);
        stage.el.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                activate();
            }
        });
    });

    return {
        update(time) {
            if (!control) {
                return;
            }

            const delta = clamp(time - lastFrame, 0, 0.033);
            lastFrame = time;

            if (time - lastInput > 2.6) {
                activeIndex = Math.floor(time / 2.4) % Math.max(stages.length, 1);
                const stage = stages[activeIndex];
                if (stage) {
                    target.x = stage.x;
                    target.y = stage.y + Math.sin(time * 1.1) * 8;
                }
            }

            current.x += (target.x - current.x) * (1 - Math.exp(-delta * 8.8));
            current.y += (target.y - current.y) * (1 - Math.exp(-delta * 8.8));
            control.setAttribute("transform", `translate(${current.x.toFixed(2)} ${current.y.toFixed(2)})`);

            const dx = current.x - core.x;
            const dy = current.y - core.y;
            const energy = clamp(Math.abs(dx) / 175, 0, 1);

            if (rotor) {
                rotorAngle += (0.8 + energy * 5.6) * delta;
                rotor.setAttribute("transform", `rotate(${(rotorAngle * 180 / Math.PI).toFixed(2)})`);
            }

            let nearestIndex = 0;
            let nearestScore = 0;
            stages.forEach((stage, index) => {
                const score = clamp(1 - Math.hypot(current.x - stage.x, current.y - stage.y) / 150, 0, 1);

                if (score > nearestScore) {
                    nearestScore = score;
                    nearestIndex = index;
                }

                stage.el.classList.toggle("is-hot", score > 0.42 || index === activeIndex);
                stage.el.classList.toggle("is-nearest", index === nearestIndex);
            });

            if (pulse) {
                pulse.setAttribute("cx", current.x.toFixed(2));
                pulse.setAttribute("cy", current.y.toFixed(2));
            }
            if (gauge) {
                gauge.setAttribute("width", (90 + energy * 150).toFixed(2));
            }

            if (time - lastTextUpdate > 0.18) {
                lastTextUpdate = time;
                const confidence = clamp(86 + nearestScore * 10 + energy * 3, 86, 99);
                if (primaryReadout) {
                    primaryReadout.textContent = `mode ${stages[nearestIndex]?.name || "ai"}`;
                }
                if (secondaryReadout) {
                    secondaryReadout.textContent = `confidence ${confidence.toFixed(0)}%`;
                }
            }
        }
    };
}

function setupSkillTrajectory() {
    const svg = document.querySelector("[data-skill-visual]");
    const tiles = Array.from(document.querySelectorAll("[data-skill-tile]")).map((tile) => ({
        el: tile,
        name: tile.dataset.skillTile || "track",
        level: Number(tile.dataset.level || 0),
        x: Number(tile.dataset.x || 0),
        y: Number(tile.dataset.y || 0)
    }));
    const links = Array.from(document.querySelectorAll("[data-skill-link]"));
    const meter = document.querySelector("[data-skill-meter]");
    const score = document.querySelector("[data-skill-score]");
    const readout = document.querySelector("[data-skill-readout]");
    const levelReadout = document.querySelector("[data-skill-level]");
    let activeIndex = 0;
    let displayedLevel = tiles[0] ? tiles[0].level : 0;
    let lastInteraction = 0;

    const setActive = (index, isManual = true) => {
        activeIndex = index;
        if (isManual) {
            lastInteraction = performance.now() / 1000;
        }

        tiles.forEach((tile, tileIndex) => {
            tile.el.classList.toggle("is-active", tileIndex === activeIndex);
        });

        if (readout && tiles[activeIndex]) {
            readout.textContent = `${tiles[activeIndex].name} track`;
        }
    };

    if (svg) {
        svg.addEventListener("pointermove", (event) => {
            if (event.pointerType !== "touch") {
                const point = getSvgPoint(svg, event);
                const nearestIndex = tiles.reduce((bestIndex, tile, tileIndex) => {
                    const best = tiles[bestIndex];
                    const bestDistance = Math.hypot(point.x - best.x, point.y - best.y);
                    const tileDistance = Math.hypot(point.x - tile.x, point.y - tile.y);
                    return tileDistance < bestDistance ? tileIndex : bestIndex;
                }, 0);
                setActive(nearestIndex);
            }
        }, { passive: true });
    }

    tiles.forEach((tile, index) => {
        tile.el.addEventListener("pointerenter", (event) => {
            if (event.pointerType !== "touch") {
                setActive(index);
            }
        });
        tile.el.addEventListener("click", () => setActive(index));
        tile.el.addEventListener("focus", () => setActive(index));
        tile.el.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setActive(index);
            }
        });
    });

    setActive(0, false);

    return {
        update(time) {
            if (!tiles.length) {
                return;
            }

            if (time - lastInteraction > 4.5) {
                setActive(Math.floor(time / 2.4) % tiles.length, false);
            }

            const activeTile = tiles[activeIndex];
            displayedLevel += (activeTile.level - displayedLevel) * 0.09;

            if (meter) {
                meter.style.strokeDasharray = `${displayedLevel.toFixed(2)} 100`;
            }
            if (score) {
                score.textContent = `${displayedLevel.toFixed(0)}%`;
            }
            if (levelReadout) {
                levelReadout.textContent = `practice ${displayedLevel.toFixed(0)}%`;
            }

            links.forEach((link, index) => {
                const isActive = index === activeIndex;
                link.style.opacity = isActive ? "0.9" : "0.24";
                link.style.strokeWidth = isActive ? "4.5" : "1.7";
            });
        }
    };
}

function getSvgPoint(svg, event) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
}

function buildArcPath(center, radius, startAngle, endAngle, segments) {
    const stepCount = Math.max(2, Math.ceil(Math.abs(endAngle - startAngle) / (Math.PI * 2) * segments));
    const points = [];

    for (let index = 0; index <= stepCount; index += 1) {
        const t = index / stepCount;
        const angle = startAngle + (endAngle - startAngle) * t;
        points.push({
            x: center.x + Math.cos(angle) * radius,
            y: center.y + Math.sin(angle) * radius
        });
    }

    return points
        .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(" ");
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
