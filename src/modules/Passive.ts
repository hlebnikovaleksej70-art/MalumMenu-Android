import { AssemblyHelper } from "../core/AssemblyHelper";
import { BaseModule } from "../core/BaseModule";
import { Logger } from "../logger/Logger";

export class PassiveModule extends BaseModule {
    public readonly name = "Passive";

    // Classes
    private Screen!: Il2Cpp.Class;
    private ResolutionManager!: Il2Cpp.Class;
    private PlayerControl!: Il2Cpp.Class;
    private RoleBehaviour!: Il2Cpp.Class;

    // Methods
    private ResolutionManager_SetResolution!: Il2Cpp.Method;
    private PlayerControl_SetKillTimer!: Il2Cpp.Method;
    private PlayerControl_FixedUpdate!: Il2Cpp.Method;

    // Resolution state
    private HasResolutionBeenChanged!: boolean;
    private OriginalWidth!: number;
    private OriginalHeight!: number;

    // Werewolf & Cooldown state
    public isWerewolfPassiveEnabled: boolean = false;
    public useCustomCooldown: boolean = false;
    public customKillCooldown: number = 0;

    public init(): void {
        // Инициализация классов разрешения экрана
        this.Screen = AssemblyHelper.CoreModule.class("UnityEngine.Screen");
        this.ResolutionManager = AssemblyHelper.AssemblyCSharp.class("ResolutionManager");
        this.ResolutionManager_SetResolution = this.ResolutionManager.method<void>("SetResolution", 3);
        this.HasResolutionBeenChanged = false;

        // Инициализация классов игрока и ролей
        this.PlayerControl = AssemblyHelper.AssemblyCSharp.class("PlayerControl");
        this.RoleBehaviour = AssemblyHelper.AssemblyCSharp.class("RoleBehaviour");
        
        this.PlayerControl_SetKillTimer = this.PlayerControl.method<void>("SetKillTimer", 1);
        this.PlayerControl_FixedUpdate = this.PlayerControl.method<void>("FixedUpdate");

        this.setupHooks();
    }

    private setupHooks(): void {
        const module = this;

        // 1. Хук на SetKillTimer: снимает любые ограничения и подставляет заданное число секунд
        this.PlayerControl_SetKillTimer.implementation = function (time: number): void {
            if (module.useCustomCooldown) {
                return module.PlayerControl_SetKillTimer.invoke.call(this, module.customKillCooldown);
            }
            return module.PlayerControl_SetKillTimer.invoke.call(this, time);
        };

        // 2. Хук на FixedUpdate: поддержание пассивной способности оборотня в каждом кадре
        this.PlayerControl_FixedUpdate.implementation = function (): void {
            module.PlayerControl_FixedUpdate.invoke.call(this);

            if (!module.isWerewolfPassiveEnabled) return;

            try {
                const localPlayer = module.PlayerControl.field<Il2Cpp.Object>("LocalPlayer").value;
                // Применяем пассивку только к локальному игроку
                if (localPlayer && !localPlayer.isNull() && this.handle.equals(localPlayer.handle)) {
                    const data = localPlayer.method<Il2Cpp.Object>("get_Data").invoke();
                    if (data && !data.isNull()) {
                        const role = data.field<Il2Cpp.Object>("Role").value;
                        if (role && !role.isNull()) {
                            // Включаем возможность использовать вентиляцию (люки) и обзор предателя
                            // (базовые пассивные механики ролей типа Оборотня / Shapeshifter / Werewolf в модах)
                            role.field<boolean>("CanVent").value = true;
                            role.field<boolean>("AffectedByLightAffectors").value = false;
                        }
                    }
                }
            } catch (e) {
                // Игнорируем ошибки до полной загрузки сцены матча
            }
        };
    }

    // Оригинальный метод изменения разрешения
    public toggleFullResolution(state: boolean): void {
        const module = this;

        if (!this.HasResolutionBeenChanged) {
            const original_resolution = module.Screen.method<Il2Cpp.Object>("get_currentResolution").invoke();
            module.OriginalWidth = original_resolution.method<number>("get_width").invoke();
            module.OriginalHeight = original_resolution.method<number>("get_height").invoke();
            Logger.debug(`[${module.name}::ToggleFullResolution] Original resolution: ${module.OriginalWidth}x${module.OriginalHeight}`);
        }
        this.HasResolutionBeenChanged = true;

        if (state) {
            const resolutions = module.Screen.method<Il2Cpp.Array<Il2Cpp.Object>>("get_resolutions").invoke();
            const width = resolutions.get(0).method<number>("get_width").invoke();
            const height = resolutions.get(0).method<number>("get_height").invoke();
            Logger.debug(`[${module.name}::ToggleFullResolution] Setting resolution to ${height}x${width}`);
            module.ResolutionManager_SetResolution.invoke(height, width, true);
        } else {
            Logger.debug(`[${module.name}::ToggleFullResolution] Resetting resolution to ${module.OriginalWidth!}x${module.OriginalHeight!}`);
            module.ResolutionManager_SetResolution.invoke(module.OriginalWidth, module.OriginalHeight, true);
        }
    }

    // Включение/выключение пассивки оборотня
    public toggleWerewolfPassive(state: boolean): void {
        this.isWerewolfPassiveEnabled = state;
        Logger.debug(`[${this.name}::WerewolfPassive] State set to: ${state}`);
    }

    // Установка кастомного времени КД убийства (без ограничений)
    public setCustomKillCooldown(seconds: number, enabled: boolean = true): void {
        this.customKillCooldown = seconds;
        this.useCustomCooldown = enabled;

        Logger.debug(`[${this.name}::KillCooldown] Set to ${seconds}s (Enabled: ${enabled})`);

        try {
            const localPlayer = this.PlayerControl.field<Il2Cpp.Object>("LocalPlayer").value;
            if (localPlayer && !localPlayer.isNull() && enabled) {
                // Мгновенно обновляем текущий таймер убийства на экране
                localPlayer.method<void>("SetKillTimer", 1).invoke(this.customKillCooldown);
            }
        } catch (e) {
            Logger.debug(`[${this.name}::KillCooldown] LocalPlayer not ready yet.`);
        }
    }
}
