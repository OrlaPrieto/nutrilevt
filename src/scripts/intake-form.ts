import { supabase } from "../lib/supabase";

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
    // Detect language from URL
    const isEnglish = window.location.pathname.startsWith('/en');
    const lang = isEnglish ? 'en' : 'es';

    const translations = {
        es: {
            required: "Este campo es obligatorio",
            invalidEmail: "Ingresa un correo electrónico válido",
            phoneFormat: "Usa el formato (222)-2437640",
            heightFormat: "Usa el formato 1.90",
            futureDate: "La fecha no puede ser futura",
            emailExists: "Este correo ya está registrado",
            errorSubmit: "Hubo un error al enviar. Por favor intenta de nuevo.",
            flatpickrLocale: "es"
        },
        en: {
            required: "This field is required",
            invalidEmail: "Enter a valid email address",
            phoneFormat: "Use format (222)-2437640",
            heightFormat: "Use format 1.75",
            futureDate: "Date cannot be in the future",
            emailExists: "This email is already registered",
            errorSubmit: "There was an error submitting. Please try again.",
            flatpickrLocale: "en"
        }
    };

    const t = translations[lang];

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
            locale: t.flatpickrLocale,
            dateFormat: "Y-m-d",
            defaultDate: "today",
            clickOpens: false,
            disableMobile: true,
        });
    }

    // Initialize Flatpickr for "Fecha de nacimiento"
    const birthDateInput = document.getElementById(
        "fecha_nacimiento"
    ) as HTMLInputElement;
    if (birthDateInput) {
        // @ts-ignore
        flatpickr(birthDateInput, {
            locale: t.flatpickrLocale,
            dateFormat: "Y-m-d",
            maxDate: "today",
            disableMobile: true,
            monthSelectorType: "dropdown",
            animate: true,
            onReady: function(selectedDates: Date[], dateStr: string, instance: any) {
                const yearInput = instance.calendarContainer.querySelector('.numInput.cur-year') as HTMLInputElement;
                if (yearInput) {
                    const yearSelect = document.createElement('select');
                    yearSelect.className = 'flatpickr-monthDropdown-years';
                    yearSelect.style.cssText = 'appearance: none; background: transparent; border: none; font-weight: 600; color: #d81b60; cursor: pointer; padding: 6px 12px; border-radius: 12px; transition: all 0.2s;';
                    
                    const currentYear = new Date().getFullYear();
                    const startYear = currentYear - 100;
                    const endYear = currentYear;

                    for (let y = endYear; y >= startYear; y--) {
                        const opt = document.createElement('option');
                        opt.value = y.toString();
                        opt.textContent = y.toString();
                        if (y === instance.currentYear) opt.selected = true;
                        yearSelect.appendChild(opt);
                    }

                    yearSelect.addEventListener('change', (e) => {
                        const target = e.target as HTMLSelectElement;
                        instance.changeYear(parseInt(target.value));
                    });

                    // Replace the input with the select
                    if (yearInput.parentNode) {
                        // Hide original input wrapper
                        const wrapper = yearInput.parentNode as HTMLElement;
                        wrapper.style.display = 'none';
                        // Insert select after the wrapper
                        wrapper.parentNode?.insertBefore(yearSelect, wrapper.nextSibling);

                        // Sync select when year changes externally (e.g., month navigation)
                        instance.config.onYearChange.push(() => {
                            yearSelect.value = instance.currentYear.toString();
                        });
                    }
                }
            },
            onChange: function (selectedDates: Date[], dateStr: string) {
                const ageInput = document.getElementById(
                    "edad"
                ) as HTMLInputElement;
                if (dateStr && ageInput) {
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
                    ageInput.value = age >= 0 ? age.toString() : "0";
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

            let value = input.value.replace(/,/g, ".").replace(/[^\d.]/g, "");
            if (value.includes(".")) {
                const parts = value.split(".");
                value = parts[0] + "." + parts.slice(1).join("").slice(0, 2);
            }
            if (value.length > 4) value = value.slice(0, 4);

            let displayValue = value ? value + " m" : "";
            input.value = displayValue;

            // Adjust cursor position
            let newLength = displayValue.length;
            if (cursorPosition >= oldLength - 2 && oldLength > 2) {
                cursorPosition = value.length;
            } else {
                cursorPosition = cursorPosition + (newLength - oldLength);
                cursorPosition = Math.min(cursorPosition, value.length);
            }
            input.setSelectionRange(cursorPosition, cursorPosition);
        });

        heightInput.addEventListener("keydown", (e) => {
            const input = e.target as HTMLInputElement;
            if (e.key === "Backspace" && input.selectionStart === input.value.length && input.value.endsWith(" m")) {
                e.preventDefault();
                let raw = input.value.slice(0, -2);
                input.value = raw.slice(0, -1);
                input.dispatchEvent(new Event("input"));
            }
        });
    }

    const TABLE_NAME = "patients";

    // Conditional Logic: Female Health
    const femaleHealthSection = document.getElementById("female-health-section");
    const genderRadios = document.querySelectorAll('input[name="genero"]');
    
    genderRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (femaleHealthSection) {
                const target = e.target as HTMLInputElement;
                femaleHealthSection.classList.toggle('hidden', target.value !== 'Femenino');
            }
        });
    });

    // Conditional Logic: Supplements
    const supplementsSection = document.getElementById("supplements-details-container");
    const supplementsRadios = document.querySelectorAll('input[name="suplementos_si_no"]');

    supplementsRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (supplementsSection) {
                const target = e.target as HTMLInputElement;
                supplementsSection.classList.toggle('hidden', target.value !== 'Si');
            }
        });
    });

    // Conditional Logic: "Otro" fields
    const setupConditionalField = (radioName: string, containerName: string = "") => {
        const radios = document.querySelectorAll(`input[name="${radioName}"]`);
        const otherInput = document.querySelector(`input[name="${radioName}_otro"]`) as HTMLInputElement;
        
        radios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (otherInput) {
                    const target = e.target as HTMLInputElement;
                    otherInput.classList.toggle('hidden-until-needed', target.value !== 'Otro' && target.value !== 'Más' && target.value !== 'Hace mas de 6 meses');
                }
            });
        });
    };

    setupConditionalField('comidas_dia');
    setupConditionalField('quien_cocina');
    setupConditionalField('comida_comprada');

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

    async function validateStep(stepIndex: number) {
        const currentStepEl = steps[stepIndex];
        clearErrors(stepIndex);

        const requiredInputs = currentStepEl.querySelectorAll("[required]");
        const processedGroups = new Set();
        let isValid = true;

        for (const input of Array.from(requiredInputs) as any[]) {
            let errorMsg = "";
            const name = input.getAttribute("name");

            if (input.type === "radio" || input.type === "checkbox") {
                if (processedGroups.has(name)) continue;
                processedGroups.add(name);

                const checked = currentStepEl.querySelector(
                    `input[name="${name}"]:checked`
                );
                if (!checked) errorMsg = t.required;
            } else if (!input.value.trim()) {
                errorMsg = t.required;
            } else if (input.type === "email") {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                const value = input.value.trim();
                
                if (value === "") {
                    // Skip validation if empty (since it's now optional)
                    continue;
                }

                if (!emailRegex.test(value)) {
                    errorMsg = t.invalidEmail;
                } else if (stepIndex === 0) {
                    // Check if email exists in Supabase
                    try {
                        const { data, error } = await supabase
                            .from(TABLE_NAME)
                            .select('email')
                            .eq('email', value)
                            .maybeSingle();
                        
                        if (data) {
                            errorMsg = t.emailExists;
                        }
                    } catch (err) {
                        console.error("Error checking email uniqueness:", err);
                    }
                }
            } else if (input.id === "telefono") {
                const phoneRegex = /^\(\d{3}\)-\d{7}$/;
                if (!phoneRegex.test(input.value.trim())) {
                    errorMsg = t.phoneFormat;
                }
            } else if (input.id === "estatura") {
                const rawHeight = input.value.replace(/ m$/i, "").trim();
                const heightRegex = /^\d\.\d{2}$/;
                if (!heightRegex.test(rawHeight)) {
                    errorMsg = t.heightFormat;
                }
            } else if (input.id === "fecha_nacimiento") {
                const selectedDate = new Date(input.value);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (selectedDate > today) {
                    errorMsg = t.futureDate;
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
        }

        return isValid;
    }

    nextBtn?.addEventListener("click", async () => {
        if (await validateStep(currentStep - 1)) {
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

        if (!(await validateStep(currentStep - 1))) return;

        loadingOverlay?.classList.remove("hidden");
        const formData = new FormData(form);
        const data: IntakeFormData = {};

        formData.forEach((value, key) => {
            let strValue = value.toString();
            if (key === "estatura") {
                strValue = strValue.replace(/ m$/i, "").trim();
            }
            
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

        // Handle missing email by generating a placeholder based on phone
        if (!data["email"] || (data["email"] as string).trim() === "") {
            const phone = (data["telefono"] as string || "").replace(/\D/g, "");
            data["email"] = `${phone || Date.now()}@nutrilev.temp`;
        }

        Object.keys(data).forEach((key) => {
            if (Array.isArray(data[key])) {
                data[key] = (data[key] as string[]).join(", ");
            }
        });

        // Consolidate notes from fields not in schema
        let extraNotes = "";
        if (data["apetito_calidad"]) extraNotes += `Apetito: ${data["apetito_calidad"]}. `;
        if (data["anclaje_ansiedad_momento"]) extraNotes += `Ansiedad: ${data["anclaje_ansiedad_momento"]}. `;
        
        if (extraNotes) {
            data["notas"] = (data["notas"] as string || "") + " " + extraNotes;
        }

        // Clean up internal/extra fields not in schema
        delete data["apetito_calidad"];
        delete data["anclaje_ansiedad_momento"];
        delete data["privacidad_acepto"];

        try {
            // Use upsert to update the record if the email already exists
            const { error } = await supabase
                .from(TABLE_NAME)
                .upsert(data, { onConflict: 'email' });

            if (error) throw error;

            // Redirect to dedicated success page, pass name for personalization
            let queryParams = "";
            if (data.nombre) {
                queryParams = `?name=${encodeURIComponent(data.nombre as string)}`;
            }
            // Use localized thank you page
            const redirectPath = isEnglish ? '/en/thank-you' : '/thank-you';
            window.location.assign(`${redirectPath}${queryParams}`);

        } catch (error) {
            console.error("Error submitting to Supabase:", error);
            alert(t.errorSubmit);
        } finally {
            loadingOverlay?.classList.add("hidden");
        }
    });

    updateForm();
}
