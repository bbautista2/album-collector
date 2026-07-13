# 📸 Guía: Cómo Tomar una Buena Foto para Escaneo AI

Cuando usas la función "Inicializar con Foto" en la creación de un álbum, Gemini necesita una foto clara para detectar los números. Aquí hay tips para maximizar la precisión:

---

## ✅ Lo que SÍ funciona bien

### 1. **Plantilla Limpia en Blanco**
- Fotografía de la plantilla original del álbum (sin colorear)
- Mejor si no tiene marcas, manchas o daños
- El contraste entre números y fondo debe ser alto

### 2. **Iluminación Correcta**
- Luz natural (ventana) o luz de LED blanca
- Evita sombras sobre la imagen
- Evita reflejos que causen brillo extremo
- La foto debe ser clara y nítida (sin borrones)

### 3. **Ángulo y Composición**
- Foto de frente (perpendicular a la plantilla)
- La plantilla debe ocupar **80-90% de la imagen**
- Márgenes pequeños alrededor
- Si la plantilla es muy grande, toma foto de una sección a la vez

### 4. **Números Legibles**
- Los números deben ser claramente visibles
- Si hay prefijos (T1, E5, etc.), ambos deben ser legibles
- Tamaño mínimo: números que ocupen al menos 10-20 píxeles
- Buen contraste color (negro sobre blanco, etc.)

### 5. **Resolución y Nitidez**
- Usa cámara de buena calidad (smartphone moderno está bien)
- Enfoca bien los números (auto-focus es suficiente)
- No uses zoom digital; acércate físicamente si es necesario
- Evita fotos borrosas

---

## ❌ Lo que NO funciona

- ❌ Foto con sombras o iluminación inconsistente
- ❌ Foto de un ángulo inclinado (no perpendicular)
- ❌ Números demasiado pequeños o difíciles de leer
- ❌ Foto muy lejana donde los números se ven como píxeles
- ❌ Plantilla coloreada/pintada (los números pueden no contrastar)
- ❌ Foto de una fotocopia mala o fotocopiada múltiples veces
- ❌ Imagen completamente oscura o sobrepuesta de luz
- ❌ Números parcialmente cortados en los bordes

---

## 📝 Ejemplos de Qué Capturar

### Plantilla Simple (Sin Prefijos)
```
[Foto de una plantilla 1x1 con cuadros numerados 1-100]
```
**Gemini detectará:** { prefix: "", numbers: [1, 2, 3, ..., 100] }

### Plantilla con Secciones
```
Sección T:  [T1] [T2] [T3] ... [T20]
Sección E:  [E1] [E2] [E3] ... [E40]
Otros:      [41] [42] [43] ... [100]
```
**Gemini detectará:**
- { prefix: "T", numbers: [1, 2, 3, ..., 20] }
- { prefix: "E", numbers: [1, 2, 3, ..., 40] }
- { prefix: "", numbers: [41, 42, ..., 100] }

---

## 🎯 Pasos para Tomar la Foto Ideal

1. **Prepara la plantilla**
   - Ten la plantilla completamente visible
   - Colócala sobre una superficie plana
   - Limpia polvo o manchas

2. **Configura la iluminación**
   - Busca luz natural de una ventana
   - O usa una lámpara LED blanca
   - Posiciónate para evitar sombras de tu cuerpo

3. **Posiciona la cámara**
   - Sostén el teléfono perpendicular a la plantilla
   - Alineación cuadrada (nivel)
   - La plantilla debe ocupar la mayoría del frame

4. **Enfoca**
   - Toca la pantalla en el área con números
   - Espera a que el auto-focus se ponga verde
   - Evita movimiento (usa atril o descansa el teléfono)

5. **Toma la foto**
   - Presiona el botón sin mover el teléfono
   - Toma 2-3 fotos para elegir la mejor

6. **Revisa antes de subir**
   - Zoom a la foto ¿Se ven claro los números?
   - ¿Hay suficiente contraste?
   - ¿Está enfocada en los números?

---

## 🔧 Troubleshooting: Si Sigue Sin Detectar

Si después de mejorar la foto aún no detecta, intenta:

1. **Toma otra foto de una sección diferente**
   - Quizá solo una parte tiene mejor calidad
   - Carga esa sección primero, luego haz otra para otra sección

2. **Prueba con mejor iluminación**
   - Cambia a una habitación más iluminada
   - Usa luz de LED blanca fría
   - Evita luz amarilla de incandescente

3. **Recorta la foto**
   - Si la plantilla ocupa poco, recórtala en la galería
   - Deja márgenes pequeños, enfócate en los números

4. **Usa modo manual si falla**
   - Si la detección sigue sin funcionar, usa "Configuración Manual"
   - Ingresa los números como rango o lista (1-100, t1-20, etc.)

---

## 💡 Pro Tips

- **Múltiples secciones?** Toma una foto de cada sección grande
- **Números prefijados?** Asegúrate de que el prefijo sea visible en la foto
- **Plantilla pegada en pared?** Usa una escalera y toma desde frente
- **Imagen de referencia?** Fotografía la plantilla original del álbum si existe

---

## 📲 Formatos Que Soportamos

La IA puede detectar automáticamente:
- ✅ Números simples: 1, 2, 3, ..., 100
- ✅ Con prefijo: T1, T2, E1, E5, A3, etc.
- ✅ Combinados: T1-T20, E1-E40, 41-100
- ✅ Símbolos: numeral #123, código CODE-5, etc. (si son claros)
- ✅ Diferentes estilos de fuente (mientras sean legibles)

---

## ¿Aún Tienes Problemas?

Si después de todos estos pasos Gemini aún no detecta:

1. Verifica que estés subiendo una imagen (no un documento PDF)
2. Asegúrate de que la imagen sea en color o B&N con contraste
3. Intenta con una pantalla/monitor que muestre la plantilla digital en lugar de papel impreso
4. Como último recurso, usa **Configuración Manual** para ingresar los números manualmente

---

## 📊 Comparación: AI vs Manual

| Aspecto | AI (Foto) | Manual |
|---------|-----------|--------|
| Rapidez | ⚡ Muy rápido | 🐢 Requiere escritura |
| Precisión | 95%+ (con buena foto) | 100% (solo si tipeas bien) |
| Esfuerzo | Mínimo (solo tomar foto) | Moderado (tipear números) |
| Mejor para | Plantillas grandes | Álbumes pequeños |
| Ideal cuando | Tienes plantilla física | Tienes lista digital |

---

**¡Listo! Con una buena foto, la detección debería funcionar perfectamente.** 🚀
