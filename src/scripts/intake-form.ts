export interface IntakeFormData {
    [key: string]: string | string[] | undefined;
    nombre?: string;
    comidas_dia?: string;
    comida_comprada?: string;
    quien_cocina?: string;
    comidas_dia_otro?: string;
    comida_comprada_otro?: string;
    quien_cocina_otro?: string;
}

export function initIntakeForm() {
    let currentStep = 1;
    const totalSteps = 7;
    const form = document.getElementById("clinical-form") as HTMLFormElement;
    const steps = document.querySelectorAll(".form-step");
    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");
    const submitBtn = document.getElementById("submit-btn");
    const progressBar = document.getElementById("form-progress");
    const loadingOverlay = document.getElementById("loading-overlay");

    if (!form) return;

    // Initialize Flatpickr for "Fecha de hoy"
    const todayInput = document.getElementById("fecha_hoy") as HTMLInputElement;
    if (todayInput) {
        // @ts-ignore
        flatpickr(todayInput, {
            locale: "es",
            dateFormat: "Y-m-d",
            defaultDate: "today",
            clickOpens: false,
        });
    }

    // Initialize Flatpickr for "Fecha de nacimiento"
    const birthDateInput = document.getElementById(
        "fecha_nacimiento"
    ) as HTMLInputElement;
    if (birthDateInput) {
        // @ts-ignore
        flatpickr(birthDateInput, {
            locale: "es",
            dateFormat: "Y-m-d",
            maxDate: "today",
            disableMobile: "true",
            onChange: function (selectedDates: Date[], dateStr: string) {
                const edadInput = document.getElementById(
                    "edad"
                ) as HTMLInputElement;
                if (dateStr && edadInput) {
                    const birthDate = new Date(dateStr);
                    const today = new Date();
                    let age = today.getFullYear() - birthDate.getFullYear();
                    const monthDiff = today.getMonth() - birthDate.getMonth();

                    if (
                        monthDiff < 0 ||
                        (monthDiff === 0 &&
                            today.getDate() < birthDate.getDate())
                    ) {
                        age--;
                    }
                    edadInput.value = age >= 0 ? age.toString() : "0";
                }
            },
        });
    }

    // Phone Mask: (XXX)-XXXXXXX
    const phoneInput = document.getElementById("telefono") as HTMLInputElement;
    if (phoneInput) {
        phoneInput.addEventListener("input", (e) => {
            const input = e.target as HTMLInputElement;
            let cursorPosition = input.selectionStart || 0;
            let oldLength = input.value.length;

            let value = input.value.replace(/\D/g, "");
            if (value.length > 10) value = value.slice(0, 10);

            let formatted = "";
            if (value.length > 0) {
                formatted = "(" + value.slice(0, 3);
                if (value.length > 3) {
                    formatted += ")-" + value.slice(3, 10);
                }
            }

            input.value = formatted;

            // Adjust cursor position
            let newLength = formatted.length;
            cursorPosition = cursorPosition + (newLength - oldLength);
            input.setSelectionRange(cursorPosition, cursorPosition);
        });
    }

    // Height Mask: X.XX
    const heightInput = document.getElementById("estatura") as HTMLInputElement;
    if (heightInput) {
        heightInput.addEventListener("input", (e) => {
            const input = e.target as HTMLInputElement;
            let cursorPosition = input.selectionStart || 0;
            let oldLength = input.value.length;

            let value = input.value.replace(/[^\d.]/g, "");
            if (value.includes(".")) {
                const parts = value.split(".");
                value = parts[0] + "." + parts.slice(1).join("").slice(0, 2);
            }
            if (value.length > 4) value = value.slice(0, 4);

            input.value = value;

            // Adjust cursor position
            let newLength = value.length;
            cursorPosition = cursorPosition + (newLength - oldLength);
            input.setSelectionRange(cursorPosition, cursorPosition);
        });
    }

    const SCRIPT_URL =
        "https://script.google.com/macros/s/AKfycbz2AGLzvmFcnLlPdoaESgSpMqmiZbiNkx6iz44M6NmHcxYdyQNQBcpzjY793bnIxnbsGA/exec";

    function updateForm(direction: "next" | "prev" = "next") {
        steps.forEach((step) => {
            const stepValue = step.getAttribute("data-step");
            if (stepValue) {
                const stepNum = parseInt(stepValue);
                const isActive = stepNum === currentStep;
                step.classList.toggle("active", isActive);

                if (isActive) {
                    step.classList.remove("slide-prev");
                    if (direction === "prev") {
                        step.classList.add("slide-prev");
                    }
                }
            }
        });

        if (progressBar) {
            progressBar.style.width = `${(currentStep / totalSteps) * 100}%`;
        }

        prevBtn?.classList.toggle("hidden", currentStep === 1);
        nextBtn?.classList.toggle("hidden", currentStep === totalSteps);
        submitBtn?.classList.toggle("hidden", currentStep !== totalSteps);

        const container = document.getElementById("intake-form-container");
        if (container) {
            const rect = container.getBoundingClientRect();
            const scrollTop =
                window.pageYOffset || document.documentElement.scrollTop;
            // Only auto-scroll on steps beyond the first to avoid jumping on page load
            if (currentStep > 1) {
                window.scrollTo({
                    top: rect.top + scrollTop - 100,
                    behavior: "smooth",
                });
            }
        }
    }

    function clearErrors(stepIndex: number) {
        const step = steps[stepIndex];
        step.querySelectorAll(".error-message").forEach((el) => el.remove());
        step.querySelectorAll(".border-red-400").forEach((el) =>
            el.classList.remove("border-red-400")
        );
    }

    function validateStep(stepIndex: number) {
        const currentStepEl = steps[stepIndex];
        clearErrors(stepIndex);

        const requiredInputs = currentStepEl.querySelectorAll("[required]");
        const processedGroups = new Set();
        let isValid = true;

        requiredInputs.forEach((input: any) => {
            let errorMsg = "";
            const name = input.getAttribute("name");

            if (input.type === "radio" || input.type === "checkbox") {
                if (processedGroups.has(name)) return;
                processedGroups.add(name);

                const checked = currentStepEl.querySelector(
                    `input[name="${name}"]:checked`
                );
                if (!checked) errorMsg = "Este campo es obligatorio";
            } else if (!input.value.trim()) {
                errorMsg = "Este campo es obligatorio";
            } else if (input.type === "email") {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(input.value.trim())) {
                    errorMsg = "Ingresa un correo electrónico válido";
                }
            } else if (input.id === "telefono") {
                const phoneRegex = /^\(\d{3}\)-\d{7}$/;
                if (!phoneRegex.test(input.value.trim())) {
                    errorMsg = "Usa el formato (222)-2437640";
                }
            } else if (input.id === "estatura") {
                const heightRegex = /^\d\.\d{2}$/;
                if (!heightRegex.test(input.value.trim())) {
                    errorMsg = "Usa el formato 1.90";
                }
            } else if (input.id === "fecha_nacimiento") {
                const selectedDate = new Date(input.value);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (selectedDate > today) {
                    errorMsg = "La fecha no puede ser futura";
                }
            }

            if (errorMsg) {
                isValid = false;
                input.classList.add("border-red-400");

                if (!currentStepEl.querySelector(`.error-${name}`)) {
                    const error = document.createElement("p");
                    error.className = `text-red-500 text-xs mt-1 error-message error-${name} w-full`;
                    error.innerText = errorMsg;

                    if (input.type === "radio" || input.type === "checkbox") {
                        // Find the closest container that holds the group (grid or flex)
                        const container = input.closest(".grid") || input.closest(".flex-wrap") || input.closest(".flex");
                        if (container) {
                            container.after(error);
                        } else {
                            input.parentElement?.after(error);
                        }
                    } else {
                        input.after(error);
                    }
                }
            }
        });

        return isValid;
    }

    nextBtn?.addEventListener("click", () => {
        if (validateStep(currentStep - 1)) {
            if (currentStep < totalSteps) {
                currentStep++;
                updateForm("next");
            }
        }
    });

    prevBtn?.addEventListener("click", () => {
        if (currentStep > 1) {
            currentStep--;
            updateForm("prev");
        }
    });

    form?.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!validateStep(currentStep - 1)) return;

        loadingOverlay?.classList.remove("hidden");
        const formData = new FormData(form);
        const data: IntakeFormData = {};

        formData.forEach((value, key) => {
            const strValue = value.toString();
            if (data[key]) {
                if (Array.isArray(data[key])) {
                    (data[key] as string[]).push(strValue);
                } else {
                    data[key] = [data[key] as string, strValue];
                }
            } else {
                data[key] = strValue;
            }
        });

        Object.keys(data).forEach((key) => {
            if (Array.isArray(data[key])) {
                data[key] = (data[key] as string[]).join(", ");
            }
        });

        if (data["comidas_dia_otro"]) {
            data["comidas_dia"] =
                (data["comidas_dia"] as string || "") + " - " + (data["comidas_dia_otro"] as string);
        }
        if (data["comida_comprada_otro"]) {
            data["comida_comprada"] =
                (data["comida_comprada"] as string || "") + " - " + (data["comida_comprada_otro"] as string);
        }
        if (data["quien_cocina_otro"]) {
            data["quien_cocina"] =
                (data["quien_cocina"] as string || "") + " - " + (data["quien_cocina_otro"] as string);
        }

        try {
            await fetch(SCRIPT_URL, {
                method: "POST",
                mode: "no-cors",
                body: JSON.stringify(data),
                headers: { "Content-Type": "application/json" },
            });

            // Redirect to dedicated success page, pass name for personalization
            let queryParams = "";
            if (data.nombre) {
                queryParams = `?nombre=${encodeURIComponent(data.nombre)}`;
            }
            window.location.assign(`/gracias${queryParams}`);

        } catch (error) {
            alert("Hubo un error al enviar. Por favor intenta de nuevo.");
        } finally {
            loadingOverlay?.classList.add("hidden");
        }
    });

    updateForm();
}
