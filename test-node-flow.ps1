$ErrorActionPreference = 'Stop'

$baseUrl = 'http://localhost:3001/api/v1'
$testName = 'PRUEBA NODE FLOW 01'
$editedName = 'PRUEBA NODE FLOW 01 EDITADO'

Write-Host '1. Login...'
$login = Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/auth/login" `
  -ContentType 'application/json' `
  -Body '{"nombre":"EVA MORALES","pin":"000000"}'

$token = $login.token
$headers = @{ Authorization = "Bearer $token" }

Write-Host '2. Me...'
$me = Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/auth/me" `
  -Headers $headers

Write-Host '3. Areas (público)...'
$areas = Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/areas"

if (-not $areas -or $areas.Count -eq 0) {
  throw 'No hay áreas disponibles para la prueba'
}

$areaId = $areas[0].id

Write-Host '4. Parámetros (público)...'
$parametros = Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/parametros"

Write-Host '5. Crear trabajador...'
$crearBody = @{ nombre = $testName; areaId = $areaId } | ConvertTo-Json
$creado = Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/trabajadores" `
  -Headers $headers `
  -ContentType 'application/json' `
  -Body $crearBody

$id = $creado.trabajador.id

Write-Host '6. Editar trabajador...'
$editarBody = @{ nombre = $editedName; areaId = $areaId } | ConvertTo-Json
$editado = Invoke-RestMethod -Method Put `
  -Uri "$baseUrl/trabajadores/$id" `
  -Headers $headers `
  -ContentType 'application/json' `
  -Body $editarBody

Write-Host '7. Desactivar trabajador...'
$desactivado = Invoke-RestMethod -Method Patch `
  -Uri "$baseUrl/trabajadores/$id/desactivar" `
  -Headers $headers

Write-Host '8. Activar trabajador...'
$activado = Invoke-RestMethod -Method Patch `
  -Uri "$baseUrl/trabajadores/$id/activar" `
  -Headers $headers

Write-Host '9. Listar evaluaciones...'
$evaluaciones = Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/evaluaciones?pagina=1&porPagina=5" `
  -Headers $headers

Write-Host '10. Verificar integridad (admin)...'
$integridad = Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/evaluaciones/integridad/verificar" `
  -Headers $headers

Write-Host '11. Listar usuarios (admin)...'
$usuarios = Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/admin/usuarios" `
  -Headers $headers

Write-Host '12. Listar áreas (admin)...'
$adminAreas = Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/admin/areas" `
  -Headers $headers

Write-Host '13. Reporte CSV (admin)...'
$csvResponse = Invoke-WebRequest -Method Get `
  -Uri "$baseUrl/admin/reporte/csv" `
  -Headers $headers
$csvContent = $csvResponse.Content

Write-Host '14. Eliminar trabajador...'
$eliminado = Invoke-RestMethod -Method Delete `
  -Uri "$baseUrl/trabajadores/$id" `
  -Headers $headers

Write-Host '15. Verificar eliminación...'
$trabajadoresFinal = Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/trabajadores?activos=false" `
  -Headers $headers

$existeFinal = $false
foreach ($t in $trabajadoresFinal.trabajadores) {
  if ($t.id -eq $id) {
    $existeFinal = $true
  }
}

$resultado = [PSCustomObject]@{
  loginUsuario = $login.usuario.nombre
  loginRequiereCambioPin = $login.usuario.requiereCambioPin
  meUsuario = $me.usuario.nombre
  areaIdUsada = $areaId
  parametrosCount = $parametros.Count
  trabajadorCreadoId = $id
  trabajadorEditadoNombre = $editado.trabajador.nombre
  desactivadoActivo = $desactivado.trabajador.activo
  activadoActivo = $activado.trabajador.activo
  integridadOk = $integridad.ok
  integridadTotalVerificado = $integridad.totalVerificado
  usuariosCount = $usuarios.Count
  adminAreasCount = $adminAreas.Count
  csvTieneBOM = $csvContent.StartsWith([char]0xFEFF)
  csvLineasCount = ($csvContent -split "`n").Count
  eliminadoOk = $eliminado.ok
  existeTrasEliminar = $existeFinal
}

$resultado | ConvertTo-Json -Depth 5
