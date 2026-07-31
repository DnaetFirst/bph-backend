$ErrorActionPreference = 'Stop'

$baseUrl = 'https://bph-backend-1.onrender.com/api/v1'
$testName = 'PRUEBA RENDER FLOW 01'
$editedName = 'PRUEBA RENDER FLOW 01 EDITADO'

Write-Host '1. Login...'
$login = Invoke-RestMethod -Method POST `
  -Uri "$baseUrl/auth/login" `
  -ContentType 'application/json' `
  -Body '{"nombre":"EVA MORALES","pin":"000000"}'

$token = $login.token
$headers = @{ Authorization = "Bearer $token" }

Write-Host '2. Me...'
$me = Invoke-RestMethod -Method GET `
  -Uri "$baseUrl/auth/me" `
  -Headers $headers

Write-Host '3. Areas...'
$areas = Invoke-RestMethod -Method GET `
  -Uri "$baseUrl/areas"

if (-not $areas -or $areas.Count -eq 0) {
  throw 'No hay áreas disponibles para la prueba'
}

$areaId = $areas[0].id

Write-Host '4. Crear trabajador...'
$crearBody = @{ nombre = $testName; areaId = $areaId } | ConvertTo-Json
$creado = Invoke-RestMethod -Method POST `
  -Uri "$baseUrl/trabajadores" `
  -Headers $headers `
  -ContentType 'application/json' `
  -Body $crearBody

$id = $creado.trabajador.id

Write-Host '5. Editar trabajador...'
$editarBody = @{ nombre = $editedName; areaId = $areaId } | ConvertTo-Json
$editado = Invoke-RestMethod -Method PUT `
  -Uri "$baseUrl/trabajadores/$id" `
  -Headers $headers `
  -ContentType 'application/json' `
  -Body $editarBody

Write-Host '6. Desactivar trabajador...'
$desactivado = Invoke-RestMethod -Method PATCH `
  -Uri "$baseUrl/trabajadores/$id/desactivar" `
  -Headers $headers

Write-Host '7. Activar trabajador...'
$activado = Invoke-RestMethod -Method PATCH `
  -Uri "$baseUrl/trabajadores/$id/activar" `
  -Headers $headers

Write-Host '8. Desactivar trabajador otra vez...'
$desactivado2 = Invoke-RestMethod -Method PATCH `
  -Uri "$baseUrl/trabajadores/$id/desactivar" `
  -Headers $headers

Write-Host '9. Eliminar trabajador...'
$eliminado = Invoke-RestMethod -Method DELETE `
  -Uri "$baseUrl/trabajadores/$id" `
  -Headers $headers

Write-Host '10. Verificar eliminación...'
$trabajadoresFinal = Invoke-RestMethod -Method GET `
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
  meUsuario = $me.usuario.nombre
  areaIdUsada = $areaId
  trabajadorCreadoId = $id
  trabajadorEditadoNombre = $editado.trabajador.nombre
  desactivadoActivo = $desactivado.trabajador.activo
  activadoActivo = $activado.trabajador.activo
  desactivadoFinalActivo = $desactivado2.trabajador.activo
  eliminadoOk = $eliminado.ok
  existeTrasEliminar = $existeFinal
}

$resultado | ConvertTo-Json -Depth 5
