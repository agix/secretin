// SecretInRunner.cpp : définit le point d'entrée pour l'application console.
//

#include "stdafx.h"
#include <Windows.h>
#include <wtsapi32.h>
#include <TlHelp32.h>
#include <Strsafe.h>

#define SVCNAME L"Secret-in.me"

DWORD Sessions = 0;
HANDLE ghSvcStopEvent = NULL;

void SvcReportEvent(LPTSTR szFunction) {
	/*
	HKEY hkResult;
	RegCreateKey(HKEY_LOCAL_MACHINE, L"SYSTEM\\CurrentControlSet\\services\\eventlog\\Application\\Secret-in.me", &hkResult);

	DWORD CategoryCount = 1;
	LPWSTR CategoryMessageFile[] = L""
	RegSetKeyValue(hkResult, NULL, L"CategoryCount", REG_DWORD, &CategoryCount, sizeof(CategoryCount));
	
	RegSetKeyValue(hkResult, NULL, L"CategoryMessageFile", 0, REG_SZ);
	RegSetKeyValue(hkResult, NULL, L"EventMessageFile", 0, REG_SZ);
	RegSetKeyValue(hkResult, NULL, L"ParameterMessageFile", 0, REG_SZ);
	RegSetKeyValue(hkResult, NULL, L"TypesSupported", REG_DWORD, EVENTLOG_AUDIT_FAILURE | EVENTLOG_AUDIT_SUCCESS);
	*/
	HANDLE hEventSource;
	LPCTSTR lpszStrings[2];
	TCHAR Buffer[80];
	hEventSource = RegisterEventSource(NULL, SVCNAME);
	if (NULL != hEventSource) {
		StringCchPrintf(Buffer, 80, L"%s failed with %d", szFunction, GetLastError());

		lpszStrings[0] = SVCNAME;
		lpszStrings[1] = Buffer;

		ReportEvent(hEventSource,
			EVENTLOG_ERROR_TYPE,
			0,
			0xC0020001L,
			NULL,
			2,
			0,
			lpszStrings,
			NULL);
	}
	DeregisterEventSource(hEventSource);
}

bool runSecretin() {
	HANDLE hToken = NULL;
	HANDLE hDupToken;
	HANDLE hProcessSnap;
	HANDLE hProcess;
	DWORD sessionId = 0;
	DWORD length;
	PROCESSENTRY32 pe;
	bool found = FALSE;

	hProcessSnap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, NULL);
	if (hProcessSnap == INVALID_HANDLE_VALUE) {
		SvcReportEvent(L"CreateToolhelp32Snapshot");
		return FALSE;
	}
	pe.dwSize = sizeof(PROCESSENTRY32);
	if (!Process32First(hProcessSnap, &pe)) {
		SvcReportEvent(L"Process32First");
		return FALSE;
	}
	do {
		if (wcsncmp(pe.szExeFile, L"winlogon.exe", 12) == NULL) {
			hProcess = OpenProcess(PROCESS_QUERY_INFORMATION, FALSE, pe.th32ProcessID);
			if (hProcess == 0) {
				SvcReportEvent(L"OpenProcess");
				continue;
			}

			if (!OpenProcessToken(hProcess, TOKEN_ALL_ACCESS, &hToken)) {
				SvcReportEvent(L"OpenProcessToken");
				CloseHandle(hProcess);
				continue;
			}
			GetTokenInformation(hToken, TokenSessionId, &sessionId, sizeof(sessionId), &length);
			if (sessionId == 0) {
				CloseHandle(hProcess);
				SvcReportEvent(L"Bad sessionId");
				continue;
			}
			CloseHandle(hProcess);

			if ((Sessions&(2 << (sessionId - 1))) != 0) {
				SvcReportEvent(L"Already exists");
				continue;
			}

			found = TRUE;
			break;
		}
	} while (Process32Next(hProcessSnap, &pe));

	if (!found) {
		SvcReportEvent(L"FindWinlogon");
		return FALSE;
	}

	if (hToken == NULL) {
		SvcReportEvent(L"hToken");
		return FALSE;
	}

	if (!DuplicateTokenEx(hToken, TOKEN_ALL_ACCESS, NULL, SecurityImpersonation, TokenPrimary, &hDupToken)) {
		SvcReportEvent(L"DuplicateTokenEx");
		return FALSE;
	}

	STARTUPINFO si;
	PROCESS_INFORMATION pi;
	memset(&pi, 0, sizeof(PROCESS_INFORMATION));
	memset(&si, 0, sizeof(STARTUPINFO));
	si.cb = sizeof(STARTUPINFO);
	si.lpDesktop = L"WinSta0\\WinLogon";
	if (!CreateProcessAsUser(hToken, L"C:\\secret-in.me-win32-x64\\secret-in.me.exe", NULL, NULL, NULL, FALSE, 0, NULL, L"C:\\secret-in.me-win32-x64\\", &si, &pi)) {
		SvcReportEvent(L"CreateProcessAsUser");
		return FALSE;
	}
	SvcReportEvent(L"New process");
	Sessions |= (2 << (sessionId-1));
	return TRUE;
}

DWORD WINAPI SvcCtrlHandler(DWORD dwControl, DWORD dwEventType, LPVOID lpEventData, LPVOID lpContext) {
	WTSSESSION_NOTIFICATION *sessionNotification;
	switch (dwControl) {
		case SERVICE_CONTROL_STOP:
			SetEvent(ghSvcStopEvent);
			break;
		case SERVICE_CONTROL_SESSIONCHANGE:
			SvcReportEvent(L"SESSIONCHANGE");
			switch (dwEventType) {
				case WTS_CONSOLE_CONNECT:
					SvcReportEvent(L"CONNECT");
					runSecretin();
					break;
				case WTS_CONSOLE_DISCONNECT:
					SvcReportEvent(L"DISCONNECT");
					sessionNotification = (WTSSESSION_NOTIFICATION*)lpEventData;
					Sessions ^= sessionNotification->dwSessionId;
					break;
				default:
					break;
			}
			break;
		case SERVICE_CONTROL_INTERROGATE:
			break;
		default:
			break;
	}
	return Sessions;
}

void WINAPI SvcMain(DWORD dwArgc, LPTSTR* lpszArgv) {
	SERVICE_STATUS gSvcStatus;
	SERVICE_STATUS_HANDLE gSvcStatusHandle = RegisterServiceCtrlHandlerEx(SVCNAME, SvcCtrlHandler, NULL);
	if (!gSvcStatusHandle) {
		SvcReportEvent(L"RegisterServiceCtrlHandler");
		return;
	}

	ghSvcStopEvent = CreateEvent(NULL, TRUE, FALSE, NULL);
	if (ghSvcStopEvent == NULL) {
		SvcReportEvent(L"CreateEvent");
		return;
	}

	gSvcStatus.dwServiceType = SERVICE_WIN32_OWN_PROCESS|SERVICE_INTERACTIVE_PROCESS;
	gSvcStatus.dwCurrentState = SERVICE_RUNNING;
	gSvcStatus.dwControlsAccepted = SERVICE_ACCEPT_STOP | SERVICE_ACCEPT_SESSIONCHANGE;
	gSvcStatus.dwWin32ExitCode = NO_ERROR;
	gSvcStatus.dwServiceSpecificExitCode = NULL;
	gSvcStatus.dwCheckPoint = NULL;
	gSvcStatus.dwWaitHint = NULL;

	SetServiceStatus(gSvcStatusHandle, &gSvcStatus);

	runSecretin();

	while (1) {
		WaitForSingleObject(ghSvcStopEvent, INFINITE);
		gSvcStatus.dwCurrentState = SERVICE_STOPPED;
		SetServiceStatus(gSvcStatusHandle, &gSvcStatus);
		return;
	}
}

int __stdcall WinMain(HINSTANCE hInst, HINSTANCE hPrevInst, char *szCmdLine, int iCmdShow)
{
	SERVICE_TABLE_ENTRY DispatchTable[] =
	{
		{SVCNAME, (LPSERVICE_MAIN_FUNCTION) SvcMain},
		{NULL, NULL}
	};
	if (!StartServiceCtrlDispatcher(DispatchTable)) {
		SvcReportEvent(L"StartServiceCtrlDispatcher");
	}

	return 0;
}
