import { AssemblyHelper } from "../core/AssemblyHelper";
import { BaseModule } from "../core/BaseModule";
import { Logger } from "../logger/Logger";

export class PassiveModule extends BaseModule {
    public readonly name = "Passive";

    // Classes
    private Screen!: Il2Cpp.Class;
    private ResolutionManager!: Il2Cpp.Class;
    private PlayerControl!: Il2Cpp.Class;

    // Methods
    private ResolutionManager_SetResolution!: Il2Cpp.Method;
    private PlayerControl_SetKillTimer!: Il2Cpp.Method;
    private PlayerControl_FixedUpdate!: Il2Cpp.Method;

    // Resolution state
    private HasResolutionBeenChanged: boolean = false;
    private OriginalWidth: number = 0;
    private OriginalHeight: number = 0;

    // Werewolf & Cooldown state (без ограничений)
    public isWerewolfPassiveEnabled: boolean = false;
    public useCustomCooldown: boolean = false;
    public customKillCooldown: number = 0;

    public init(): void {
        this.Screen = AssemblyHelper.CoreModule.class("UnityEngine.Screen");
        this.ResolutionManager = AssemblyHelper.AssemblyCSharp.class("ResolutionManager");
        this.ResolutionManager_SetResolution = this.ResolutionManager.method<void>("SetResolution", 3);

        this.PlayerControl = AssemblyHelper.AssemblyCSharp.class("PlayerControl");
        this.PlayerControl_SetKillTimer = this.PlayerControl.method<void>("SetKillTimer", 1);
        this.PlayerControl_FixedUpdate = this.PlayerControl.method<void>("FixedUpdate");

        this.setupHooks();
    }

    private setupHooks(): void {
        const module = this;

        // Исправленная сигнатура implementation для frida-il2cpp-bridge
        this.PlayerControl_SetKillTimer.implementation = function (
            this: Il2Cpp.Class | Il2Cpp.Object | Il2Cpp.ValueType,
            ...parameters: Il2Cpp.Parameter.Type[]
        ): Il2Cpp.ReturnType {
            const rawTime = parameters[0] as unknown as number;
            const targetTime = module.useCustomCooldown ? module.customKillCooldown : rawTime;
            return module.PlayerControl_SetKillTimer.invoke.call(this, targetTime) as Il2Cpp.ReturnType;
        };

        this.PlayerControl_FixedUpdate.implementation = function (
            this: Il2Cpp.Class | Il2Cpp.Object | Il2Cpp.ValueType,
            ...parameters: Il2Cpp.Parameter.Type[]
        ): Il2Cpp.ReturnType {
            const result = module.PlayerControl_FixedUpdate.invoke.call(this, ...parameters) as Il2Cpp.ReturnType;

            if (!module.isWerewolfPassiveEnabled) {
                return result;
            }

            try {
                const localPlayerField = module.PlayerControl.tryField<Il2Cpp.Object>("LocalPlayer");
                const localPlayer = localPlayerField?.value;

                if (!localPlayer || localPlayer.isNull() || !(this instanceof Il2Cpp.Object) || !this.handle.equals(localPlayer.handle)) {
                    return result;
                }

                const data = localPlayer.method<Il2Cpp.Object>("get_Data").invoke();
                if (!data || data.isNull()) return result;

                const role = data.method<Il2Cpp.Object>("get_Role").invoke();
                if (!role || role.isNull()) return result;

                const canVentField = role.tryField<boolean>("CanVent");
                if (canVentField) {
                    canVentField.value = true;
                }
            } catch {
                // Игнорируем до появления игрока в матче
            }

            return result;
        };
    }

    public toggleFullResolution(state: boolean): void {
        if (!this.HasResolutionBeenChanged) {
            const currentResolution = this.Screen.method<Il2Cpp.Object>("get_currentResolution").invoke();
            this.OriginalWidth = currentResolution.method<number>("get_width").invoke();
            this.OriginalHeight = currentResolution.method<number>("get_height").invoke();
            this.HasResolutionBeenChanged = true;
            Logger.debug(`[${this.name}::ToggleFullResolution] Original resolution: ${this.OriginalWidth}x${this.OriginalHeight}`);
        }

        if (state) {
            const resolutions = this.Screen.method<Il2Cpp.Array<Il2Cpp.Object>>("get_resolutions").invoke();
            const firstRes = resolutions.get(0);
            const width = firstRes.method<number>("get_width").invoke();
            const height = firstRes.method<number>("get_height").invoke();
            Logger.debug(`[${this.name}::ToggleFullResolution] Setting resolution to ${height}x${width}`);
            this.ResolutionManager_SetResolution.invoke(height, width, true);
        } else {
            Logger.debug(`[${this.name}::ToggleFullResolution] Resetting resolution to ${this.OriginalWidth}x${this.OriginalHeight}`);
            this.ResolutionManager_SetResolution.invoke(this.OriginalWidth, this.OriginalHeight, true);
        }
    }

    public toggleWerewolfPassive(state?: boolean): boolean {
        this.isWerewolfPassiveEnabled = state !== undefined ? state : !this.isWerewolfPassiveEnabled;
        Logger.debug(`[${this.name}::WerewolfPassive] Enabled: ${this.isWerewolfPassiveEnabled}`);
        return this.isWerewolfPassiveEnabled;
    }

    public setKillCooldownSeconds(seconds: number, enabled: boolean = true): void {
        this.customKillCooldown = seconds;
        this.useCustomCooldown = enabled;
        Logger.debug(`[${this.name}::KillCooldown] Seconds: ${seconds}, Enabled: ${enabled}`);

        if (!enabled) return;

        try {
            const localPlayer = this.PlayerControl.tryField<Il2Cpp.Object>("LocalPlayer")?.value;
            if (localPlayer && !localPlayer.isNull()) {
                localPlayer.method<void>("SetKillTimer", 1).invoke(this.customKillCooldown);
            }
        } catch {
            // Игрок ещё не создан
        }
    }

    public resetKillCooldown(): void {
        this.useCustomCooldown = false;
        Logger.debug(`[${this.name}::KillCooldown] Reset to default`);
    }
}
